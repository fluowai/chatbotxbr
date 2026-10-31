package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

type Session struct {
	ID        string
	Client    *whatsmeow.Client
	QRCode    string
	QRBase64  string
	Status    string // "DISCONNECTED", "CONNECTING", "QR_READY", "CONNECTED"
	CreatedAt time.Time
}

var (
	sessions     = make(map[string]*Session)
	sessionsLock sync.RWMutex
	container    *sqlstore.Container
	webhookURL   string
	apiSecret    string
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8089"
	}

	webhookURL = os.Getenv("WEBHOOK_URL")
	if webhookURL == "" {
		webhookURL = "http://localhost:3123/api/whatsmeow/webhook"
	}

	apiSecret = os.Getenv("WHATSMEOW_SECRET")

	dbPath := os.Getenv("DATA_PATH")
	if dbPath == "" {
		dbPath = "./data"
	}
	_ = os.MkdirAll(dbPath, 0755)

	dbLog := waLog.Stdout("Database", "INFO", true)
	var err error
	container, err = sqlstore.New(context.Background(), "sqlite3", fmt.Sprintf("file:%s/whatsmeow.db?_foreign_keys=on", dbPath), dbLog)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/session/create", authMiddleware(handleCreateSession))
	mux.HandleFunc("/session/status", authMiddleware(handleGetStatus))
	mux.HandleFunc("/session/qr", authMiddleware(handleGetQR))
	mux.HandleFunc("/session/logout", authMiddleware(handleLogout))
	mux.HandleFunc("/message/send", authMiddleware(handleSendMessage))

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	go func() {
		log.Printf("Whatsmeow Bridge running on :%s (Webhook: %s)", port, webhookURL)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}

func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if apiSecret != "" {
			token := r.Header.Get("X-Api-Secret")
			if token != apiSecret {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
		}
		w.Header().Set("Content-Type", "application/json")
		next(w, r)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
		"engine": "whatsmeow",
		"time":   time.Now().Format(time.RFC3339),
	})
}

func handleCreateSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		SessionID string `json:"sessionId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SessionID == "" {
		http.Error(w, `{"error":"sessionId is required"}`, http.StatusBadRequest)
		return
	}

	sessionsLock.Lock()
	existing, exists := sessions[req.SessionID]
	if exists && existing.Client != nil && existing.Client.IsConnected() {
		sessionsLock.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    existing.Status,
			"sessionId": req.SessionID,
			"connected": true,
		})
		return
	}

	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil {
		sessionsLock.Unlock()
		http.Error(w, fmt.Sprintf(`{"error":"failed to get device: %v"}`, err), http.StatusInternalServerError)
		return
	}

	clientLog := waLog.Stdout(fmt.Sprintf("Client-%s", req.SessionID), "INFO", true)
	client := whatsmeow.NewClient(deviceStore, clientLog)

	session := &Session{
		ID:        req.SessionID,
		Client:    client,
		Status:    "CONNECTING",
		CreatedAt: time.Now(),
	}
	sessions[req.SessionID] = session
	sessionsLock.Unlock()

	client.AddEventHandler(func(rawEvt interface{}) {
		handleEvent(session, rawEvt)
	})

	if client.Store.ID == nil {
		// New login -> Listen for QR codes
		qrChan, _ := client.GetQRChannel(context.Background())
		err = client.Connect()
		if err != nil {
			log.Printf("Failed to connect client %s: %v", req.SessionID, err)
			session.Status = "DISCONNECTED"
			return
		}

		go func() {
			for evt := range qrChan {
				if evt.Event == "code" {
					session.QRCode = evt.Code
					session.Status = "QR_READY"

					pngBytes, err := qrcode.Encode(evt.Code, qrcode.Medium, 256)
					if err == nil {
						session.QRBase64 = "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngBytes)
					}
					log.Printf("Session %s: New QR code generated", req.SessionID)
					notifyWebhook(session.ID, "qr_code", map[string]interface{}{
						"qrCode":   session.QRCode,
						"qrBase64": session.QRBase64,
					})
				} else {
					log.Printf("Session %s: QR event: %s", req.SessionID, evt.Event)
				}
			}
		}()
	} else {
		// Already logged in
		err = client.Connect()
		if err != nil {
			session.Status = "DISCONNECTED"
		} else {
			session.Status = "CONNECTED"
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"sessionId": req.SessionID,
		"status":    session.Status,
	})
}

func handleGetStatus(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("sessionId")
	sessionsLock.RLock()
	session, exists := sessions[sessionID]
	sessionsLock.RUnlock()

	if !exists {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}

	connected := session.Client != nil && session.Client.IsConnected()
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"sessionId": session.ID,
		"status":    session.Status,
		"connected": connected,
	})
}

func handleGetQR(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("sessionId")
	sessionsLock.RLock()
	session, exists := sessions[sessionID]
	sessionsLock.RUnlock()

	if !exists {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"sessionId": session.ID,
		"status":    session.Status,
		"qrCode":    session.QRCode,
		"qrBase64":  session.QRBase64,
	})
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SessionID string `json:"sessionId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SessionID == "" {
		http.Error(w, `{"error":"sessionId is required"}`, http.StatusBadRequest)
		return
	}

	sessionsLock.Lock()
	session, exists := sessions[req.SessionID]
	if exists && session.Client != nil {
		_ = session.Client.Logout()
		delete(sessions, req.SessionID)
	}
	sessionsLock.Unlock()

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

type SendMessageRequest struct {
	SessionID string `json:"sessionId"`
	To        string `json:"to"` // Phone number with DDI, ex: 5511999999999
	Text      string `json:"text"`
}

func handleSendMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req SendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SessionID == "" || req.To == "" {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	sessionsLock.RLock()
	session, exists := sessions[req.SessionID]
	sessionsLock.RUnlock()

	if !exists || session.Client == nil || !session.Client.IsConnected() {
		http.Error(w, `{"error":"session not connected"}`, http.StatusBadRequest)
		return
	}

	recipientJID := types.NewJID(req.To, types.DefaultUserServer)
	msg := &waE2E.Message{
		Conversation: proto.String(req.Text),
	}

	resp, err := session.Client.SendMessage(context.Background(), recipientJID, msg)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to send message: %v"}`, err), http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp.Unix(),
	})
}

func handleEvent(session *Session, rawEvt interface{}) {
	switch evt := rawEvt.(type) {
	case *events.Connected:
		session.Status = "CONNECTED"
		session.QRCode = ""
		session.QRBase64 = ""
		log.Printf("Session %s: Connected!", session.ID)
		notifyWebhook(session.ID, "connected", map[string]interface{}{
			"jid": session.Client.Store.ID.String(),
		})

	case *events.LoggedOut:
		session.Status = "DISCONNECTED"
		log.Printf("Session %s: Logged out!", session.ID)
		notifyWebhook(session.ID, "disconnected", map[string]interface{}{
			"reason": evt.Reason.String(),
		})

	case *events.Message:
		var text string
		if evt.Message.GetConversation() != "" {
			text = evt.Message.GetConversation()
		} else if evt.Message.GetExtendedTextMessage() != nil {
			text = evt.Message.GetExtendedTextMessage().GetText()
		}

		notifyWebhook(session.ID, "message", map[string]interface{}{
			"id":        evt.Info.ID,
			"from":      evt.Info.Sender.User,
			"chatJid":   evt.Info.Chat.String(),
			"timestamp": evt.Info.Timestamp.Unix(),
			"fromMe":    evt.Info.IsFromMe,
			"text":      text,
			"isGroup":   evt.Info.IsGroup,
		})

	case *events.Receipt:
		notifyWebhook(session.ID, "receipt", map[string]interface{}{
			"messageIds": evt.MessageIDs,
			"chatJid":    evt.Chat.String(),
			"status":     evt.Type.String(),
			"timestamp":  evt.Timestamp.Unix(),
		})
	}
}

func notifyWebhook(sessionID, eventType string, data map[string]interface{}) {
	if webhookURL == "" {
		return
	}

	payload := map[string]interface{}{
		"sessionId": sessionID,
		"event":     eventType,
		"data":      data,
		"engine":    "whatsmeow",
		"timestamp": time.Now().Unix(),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return
	}

	go func() {
		req, err := http.NewRequest("POST", webhookURL, bytes.NewBuffer(body))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		if apiSecret != "" {
			req.Header.Set("X-Api-Secret", apiSecret)
		}

		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(req)
		if err == nil {
			_ = resp.Body.Close()
		}
	}()
}
