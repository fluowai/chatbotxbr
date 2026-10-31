import { normalizeBrazilianPhone } from "@chatbotx.io/utils"
import { logger } from "../logger"

export interface WhatsmeowSessionStatus {
  sessionId: string
  status: "DISCONNECTED" | "CONNECTING" | "QR_READY" | "CONNECTED"
  connected: boolean
  qrCode?: string
  qrBase64?: string
}

export interface SendTextMessageInput {
  sessionId: string
  to: string
  text: string
}

export class WhatsmeowService {
  private get baseUrl(): string {
    return process.env.WHATSMEOW_BRIDGE_URL || "http://localhost:8089"
  }

  private get secret(): string | undefined {
    return process.env.WHATSMEOW_SECRET
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (this.secret) {
      h["X-Api-Secret"] = this.secret
    }
    return h
  }

  async createSession(sessionId: string): Promise<WhatsmeowSessionStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/session/create`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ sessionId }),
      })

      if (!res.ok) {
        throw new Error(`Failed to create session: ${res.statusText}`)
      }

      return (await res.json()) as WhatsmeowSessionStatus
    } catch (err) {
      logger.error({ err, sessionId }, "whatsmeow: createSession failed")
      throw err
    }
  }

  async getQrCode(sessionId: string): Promise<{ qrCode?: string; qrBase64?: string; status: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/session/qr?sessionId=${encodeURIComponent(sessionId)}`, {
        headers: this.headers,
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch QR code: ${res.statusText}`)
      }

      return await res.json()
    } catch (err) {
      logger.error({ err, sessionId }, "whatsmeow: getQrCode failed")
      throw err
    }
  }

  async getStatus(sessionId: string): Promise<WhatsmeowSessionStatus> {
    try {
      const res = await fetch(`${this.baseUrl}/session/status?sessionId=${encodeURIComponent(sessionId)}`, {
        headers: this.headers,
      })

      if (!res.ok) {
        throw new Error(`Failed to get status: ${res.statusText}`)
      }

      return (await res.json()) as WhatsmeowSessionStatus
    } catch (err) {
      logger.error({ err, sessionId }, "whatsmeow: getStatus failed")
      throw err
    }
  }

  async sendTextMessage(input: SendTextMessageInput): Promise<{ success: boolean; messageId: string }> {
    const rawTo = input.to.replace(/\D/g, "")
    // Normaliza número brasileiro garantindo 55 + DDD + 9 dígitos
    const normalizedTo = normalizeBrazilianPhone(rawTo)?.replace("+", "") || rawTo

    try {
      const res = await fetch(`${this.baseUrl}/message/send`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          sessionId: input.sessionId,
          to: normalizedTo,
          text: input.text,
        }),
      })

      if (!res.ok) {
        throw new Error(`Failed to send message: ${res.statusText}`)
      }

      return await res.json()
    } catch (err) {
      logger.error({ err, to: normalizedTo }, "whatsmeow: sendTextMessage failed")
      throw err
    }
  }

  async logout(sessionId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/session/logout`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ sessionId }),
      })

      return res.ok
    } catch (err) {
      logger.error({ err, sessionId }, "whatsmeow: logout failed")
      return false
    }
  }
}

export const whatsmeowService = new WhatsmeowService()
