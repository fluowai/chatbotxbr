# Guia Definitivo de Operação em Produção — ChatbotX

Este documento consolida a arquitetura, topologia de rede, requisitos de infraestrutura, procedimentos de deploy, segurança e rotinas de manutenção para operar a plataforma **ChatbotX** em ambiente de produção com alta disponibilidade e confiabilidade.

---

## 1. Arquitetura Operacional do Sistema

O ChatbotX é uma plataforma distribuída orientada a eventos. Em produção, ele opera por meio da cooperação de 5 serviços de aplicação e 4 serviços de infraestrutura de dados.

```mermaid
graph TD
    User([Navegador / Operador / Webchat]) -->|HTTPS / WSS| Proxy[Proxy Reverso Nginx / Caddy]
    Webhooks([Meta / WhatsApp / Webhooks / PIX]) -->|HTTPS POST| Proxy

    subgraph "Camada de Borda (Host / DMZ)"
        Proxy -->|Port 3000 / HTTP| Builder[apps/builder: Next.js 16 Web & API]
        Proxy -->|Port 1999 / WebSocket| Realtime[apps/realtime: uWebSockets Gateway]
        Proxy -->|Port 9000 / Storage| Storage[RustFS / MinIO / S3 Object Storage]
    end

    subgraph "Rede da Aplicação (chatbotx-network)"
        Builder -->|Leitura / Escrita| DB[(PostgreSQL + pgvector + Timescale)]
        Builder -->|Cache, PubSub, Streams| Cache[(Redis 8 com AOF)]
        Builder -->|Despacho de Jobs| Worker[apps/worker: BullMQ Worker]
        Builder -->|QR Code & Envio| Whatsmeow[apps/whatsmeow-bridge: Go Whatsmeow]
        
        Realtime -->|Consome Eventos / Streams| Cache
        Realtime -->|Reporta Presença HTTP| Builder
        
        Worker -->|Execução de Jobs| DB
        Worker -->|Filas e Locks| Cache
        Worker -->|Armazenamento de Mídia| Storage
        
        Whatsmeow -->|Webhook Mensagens Recebidas| Builder
    end

    subgraph "Rede Interna Restrita (internal-executor-network)"
        Worker -->|Execução JS Segura / Token Bearer| Sandbox[apps/javascript-executor: isolated-vm]
    end
```

### Papel de Cada Serviço:

| Serviço | Tecnologia | Porta Interna | Função Principal em Produção |
| :--- | :--- | :--- | :--- |
| **`builder`** | Next.js 16 / React 19 (Node 24) | `3000` | Interface do usuário (RSC), endpoints de autenticação (`better-auth`), API pública oRPC, endpoints de webhooks (WhatsApp, Meta, infoprodutos, PIX). |
| **`worker`** | Node.js 24 / BullMQ | N/A (background) | Motor assíncrono de background: processamento de mensagens no inbox, agentes de IA, agendamento de transmissões em massa (broadcast), fluxos automáticos e expiração de carrinhos. Roda em modo `standalone` (~500MB de RAM) ou decomposto. |
| **`realtime`** | uWebSockets.js / Node.js 24 | `1999` | Gateway de WebSockets em C++ de altíssimo desempenho. Consome Redis Streams particionados por workspace e entrega eventos em tempo real (novas mensagens, presença de atendentes, digitação). |
| **`javascript-executor`** | isolated-vm / Node.js 24 | `3210` | Sandbox V8 seguro para rodar blocos de código JavaScript customizados definidos nos fluxos. **Isolado em rede interna**, sem acesso à internet externa, rodando com privilégios mínimos (`cap_drop: ALL`, `read_only: true`). |
| **`whatsmeow-bridge`** | Go 1.22 / SQLite | `8089` | Microserviço nativo em Go responsável pela conexão direta de instâncias de WhatsApp via QR Code e persistência local da sessão de rádio. |
| **`postgres`** | TimescaleDB / PG 18 (com `pgvector`) | `5432` | Banco relacional principal. Armazena usuários, workspaces, contatos, mensagens, estatísticas e vetores de IA para RAG. |
| **`redis`** | Redis 8 Alpine | `6379` | Broker de mensagens, filas BullMQ, cache de cotas e Redis Streams para o gateway em tempo real. Deve rodar com persistência AOF (`appendonly yes`). |
| **`filesystem`** | RustFS / MinIO / AWS S3 | `9000` | Armazenamento de objetos (áudios, imagens, vídeos, PDFs e avatares de contatos). |

---

## 2. Requisitos de Infraestrutura (Sizing)

### Dimensionamento Mínimo (Pequena Operação / Até 10.000 contatos ativos):
- **Servidor:** VPS Cloud (Ubuntu 24.04 LTS).
- **CPU:** 4 vCPUs.
- **Memória RAM:** 8 GB.
- **Armazenamento:** 80 GB SSD NVMe.
- **Swap:** 4 GB configurado.

### Dimensionamento Recomendado (Escala Comercial / Agências White-Label / 50.000+ contatos):
- **Servidor:** VPS Dedicado ou Bare Metal (Ubuntu 24.04 LTS).
- **CPU:** 8 vCPUs.
- **Memória RAM:** 16 GB.
- **Armazenamento:** 160 a 250 GB SSD NVMe.
- **Rede:** 1 Gbps com tráfego ilimitado.

---

## 3. Checklist de Segurança e Variáveis de Ambiente (`.env`)

No servidor de produção, crie o arquivo `.env` na raiz do projeto (`/opt/chatbotx/.env`). **Nunca utilize chaves de desenvolvimento em produção.**

### Geração de Chaves Criptográficas Fortes:
Execute no terminal do servidor para gerar os valores:

```bash
# BETTER_AUTH_SECRET (32-byte base64)
openssl rand -base64 32

# ENCRYPTION_KEY (32-byte hex - 64 caracteres)
openssl rand -hex 32

# REALTIME_BROADCAST_SECRET (pelo menos 32 caracteres)
openssl rand -hex 24

# JAVASCRIPT_EXECUTOR_TOKEN (pelo menos 32 caracteres)
openssl rand -hex 24

# WHATSMEOW_SECRET
openssl rand -hex 16
```

### Configurações Obrigatórias no `.env`:

```ini
# ─── MODO E LICENCIAMENTO ───
NEXT_PUBLIC_EDITION=enterprise
WHITELABEL_UNLOCKED=true
NEXT_PUBLIC_APP_NAME="Chatbot"
BRANDING_TITLE="⚡ Powered by Chatbot"
POLICY_URL="https://seusite.com.br/politica"
TERMS_OF_SERVICE_URL="https://seusite.com.br/termos"

# ─── PLATFORM ADMIN ───
PLATFORM_ADMIN_EMAIL=admin@seudominio.com.br
SUPPORT_ACCESS_REQUIRE_CONSENT=false

# ─── AUTENTICAÇÃO E URLS PÚBLICAS ───
BETTER_AUTH_SECRET=<COLE_O_SECRET_BASE64_GERADO>
BETTER_AUTH_URL=https://app.seudominio.com.br
NEXT_PUBLIC_BUILDER_URL=https://app.seudominio.com.br

# Se for usar Broker OAuth Centralizado para revendas:
# NEXT_PUBLIC_BROKER_URL=https://auth.seudominio.com.br

# ─── CRIPTOGRAFIA DE DADOS EM REPOUSO ───
ENCRYPTION_KEY=<COLE_A_CHAVE_HEX_64_CHARS_GERADA>

# ─── BANCO DE DADOS (POSTGRESQL) ───
POSTGRES_DB=chatbotx
POSTGRES_USER=chatbotx
POSTGRES_PASSWORD=<SENHA_FORTE_POSTGRES>
DATABASE_URL=postgresql://chatbotx:<SENHA_FORTE_POSTGRES>@postgres:5432/chatbotx?schema=public
DATABASE_POOL_MAX=20

# ─── REDIS ───
REDIS_URL=redis://redis:6379

# ─── REALTIME GATEWAY ───
REALTIME_BROADCAST_SECRET=<COLE_O_SECRET_REALTIME_GERADO>

# ─── JAVASCRIPT EXECUTOR ───
JAVASCRIPT_EXECUTOR_URL=http://javascript-executor:3210
JAVASCRIPT_EXECUTOR_TOKEN=<COLE_O_TOKEN_EXECUTOR_GERADO>
MAX_CONCURRENCY=4

# ─── ARMAZENAMENTO S3 / RUSTFS ───
S3_ACCESS_KEY_ID=chatbotx
S3_SECRET_ACCESS_KEY=<CHAVE_SECRETA_S3>
S3_BUCKET=chatbotx
S3_REGION=us-east-1
S3_ENDPOINT=http://filesystem:9000
STORED_IMAGE_OPTIMIZATION=on

# ─── E-MAIL TRANSACIONAL (SMTP) ───
# Exemplo com SendGrid, Amazon SES ou Postmark:
SMTP_SERVER=smtp://apikey:SUA_CHAVE_SMTP@smtp.sendgrid.net:587
SMTP_FROM="Chatbot Plataforma <nao-responda@seudominio.com.br>"

# ─── WHATSAPP NÃO-OFICIAL (WHATSMEOW) ───
WHATSMEOW_BRIDGE_URL=http://whatsmeow-bridge:8089
WHATSMEOW_SECRET=<COLE_O_SEGREDO_WHATSMEOW>
WHATSMEOW_WEBHOOK_URL=http://builder:3000/api/whatsmeow/webhook

# ─── GATEWAYS BRASILEIROS (OPCIONAIS) ───
ASAAS_API_KEY=
ASAAS_ENVIRONMENT=production
MERCADOPAGO_ACCESS_TOKEN=
DEFAULT_PIX_KEY=financeiro@seudominio.com.br
DEFAULT_PIX_NAME="Sua Empresa Ltda"
DEFAULT_PIX_CITY="SAO PAULO"

# ─── LOGGING EM PRODUÇÃO ───
LOG_LEVEL=info
LOG_DEBUG=false
```

---

## 4. Configuração do Proxy Reverso com SSL

Em produção (`NODE_ENV=production`), o Next.js **deliberadamente não faz proxy interno de `/ws/*` ou `/storage/*`** (veja `apps/builder/next.config.ts`). Essa função cabe ao proxy reverso.

### Opção A: Nginx (Configuração Completa)

Crie `/etc/nginx/sites-available/chatbotx.conf`:

```nginx
# Redirecionamento HTTP -> HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name app.seudominio.com.br;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.seudominio.com.br;

    # Certificados SSL (Let's Encrypt / Certbot)
    ssl_certificate /etc/letsencrypt/live/app.seudominio.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.seudominio.com.br/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Limite de Upload (alinhado com Next.js serverActions 21MB)
    client_max_body_size 25M;

    # 1. Gateway Realtime WebSocket (/ws/* -> realtime:1999)
    location /ws/ {
        proxy_pass http://127.0.0.1:1999/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # 2. Mídias e Arquivos Públicos (/storage/* -> filesystem:9000/chatbotx/*)
    location /storage/ {
        proxy_pass http://127.0.0.1:9000/chatbotx/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    # 3. Aplicação Web Next.js (Builder, API, Webhooks)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Buffer e Timeouts para rotas de longa duração / SSE
        proxy_buffering off;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

### Opção B: Caddy (Alternativa com SSL 100% Automático)

Crie `/etc/caddy/Caddyfile`:

```caddy
app.seudominio.com.br {
    request_body {
        max_size 25MB
    }

    # Realtime WebSocket
    handle_path /ws/* {
        reverse_proxy 127.0.0.1:1999
    }

    # Storage S3
    handle_path /storage/* {
        reverse_proxy 127.0.0.1:9000 {
            rewrite /chatbotx/{path}
        }
    }

    # Next.js Builder
    handle {
        reverse_proxy 127.0.0.1:3000
    }
}
```

---

## 5. Procedimento de Deploy Passo a Passo (Runbook)

### Passo 1: Preparar o Servidor
```bash
# Atualizar pacotes
sudo apt update && sudo apt upgrade -y

# Instalar Docker Engine e Plugin Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Configurar Firewall UFW (Segurança Crítica)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Passo 2: Clonar o Repositório e Configurar `.env`
```bash
cd /opt
sudo git clone <URL_DO_SEU_REPOSITORIO> chatbotx
cd chatbotx
sudo chown -R $USER:$USER .

# Copiar e preencher o .env com as chaves fortes geradas
cp .env.example .env
nano .env
```

### Passo 3: Inicializar a Infraestrutura de Banco e Filas
```bash
# Iniciar Postgres, Redis, RustFS e Whatsmeow
docker compose -f docker-compose.prod.yml up -d postgres redis filesystem filesystem-init whatsmeow-bridge

# Aguardar os healthchecks ficarem saudáveis
docker compose -f docker-compose.prod.yml ps
```

### Passo 4: Executar as Migrações do Banco de Dados
O script `db:migrate` aplica com segurança todas as 277 migrações do Drizzle:
```bash
# Executar migração via container builder (ou local com pnpm)
docker compose -f docker-compose.prod.yml run --rm builder migrate
```

### Passo 5: Criar o Usuário Master e Workspace Raiz
Execute o script validado com `better-auth`:
```bash
# Cria o usuário Super-Admin, Tenant "1" e Quota Ilimitada
docker compose -f docker-compose.prod.yml run --rm builder node /app/packages/database/scripts/create-master-user.mjs
```
*Saída esperada:*
```text
✅ Root Tenant ('1') inicializado.
✅ Usuário criado com ID: ...
✅ Credenciais cadastradas (Senha: Admin@1234)
👑 Promovido a Super-Admin da Plataforma!
💎 Quota Enterprise White-Label Ilimitada aplicada!
🏢 Workspace Master criado: Matriz Brasil (Master)
```

### Passo 6: Subir os Serviços de Aplicação
```bash
docker compose -f docker-compose.prod.yml up -d builder worker realtime javascript-executor
```

### Passo 7: Verificar o Status dos Serviços
```bash
docker compose -f docker-compose.prod.yml ps
```
Todos os serviços devem reportar status `Up` ou `Up (healthy)`.

Verifique os logs para garantir ausência de erros:
```bash
docker compose -f docker-compose.prod.yml logs -f --tail=100 builder worker realtime
```

---

## 5.1 Alternativa: Deploy via Docker Stack (Portainer / Coolify / GHCR)

Se você preferir não compilar as imagens no servidor de produção e usar imagens pré-compiladas geradas pelo GitHub Actions:

1. **Geração das Imagens no GitHub:**
   - Faça o push do repositório para o seu GitHub:
     ```bash
     git remote set-url origin https://github.com/SEU_USUARIO/SEU_REPO.git
     git push -u origin main
     ```
   - O GitHub Actions executará o workflow `.github/workflows/release.yml` e publicará as 6 imagens no **GitHub Container Registry (`ghcr.io`)**:
     * `ghcr.io/SEU_USUARIO/chatbotx-builder:main`
     * `ghcr.io/SEU_USUARIO/chatbotx-worker:main`
     * `ghcr.io/SEU_USUARIO/chatbotx-realtime:main`
     * `ghcr.io/SEU_USUARIO/chatbotx-javascript-executor:main`
     * `ghcr.io/SEU_USUARIO/chatbotx-whatsmeow:main`
     * `ghcr.io/SEU_USUARIO/chatbotx-mcp:main`

2. **No Servidor ou no Portainer:**
   - Autentique o servidor no GHCR (caso o repositório/pacotes sejam privados):
     ```bash
     echo "SEU_PERSONAL_ACCESS_TOKEN" | docker login ghcr.io -u SEU_USUARIO --password-stdin
     ```
   - No **Portainer**: Vá em **Stacks** -> **Add Stack** -> Cole o conteúdo de `docker-stack.yml` e configure as variáveis de ambiente na seção "Environment variables".
   - Ou via **Docker Compose**:
     ```bash
     DOCKER_IMAGE_NAMESPACE=seu_usuario docker compose -f docker-stack.yml up -d
     ```
   - Aplique as migrações e crie o usuário master:
     ```bash
     docker compose -f docker-stack.yml run --rm builder migrate
     docker compose -f docker-stack.yml run --rm builder node /app/packages/database/scripts/create-master-user.mjs
     ```

---

## 6. Rotina de Manutenção e Atualizações (Zero-Downtime Rollout)

Para atualizar o sistema sem interromper conexões ou corromper o banco de dados:

```bash
# 1. Puxar as novidades do código
git pull origin main

# 2. Reconstruir as imagens com cache
docker compose -f docker-compose.prod.yml build builder worker realtime

# 3. Rodar migrações pendentes (se houver)
docker compose -f docker-compose.prod.yml run --rm builder migrate

# 4. Atualizar os containers
docker compose -f docker-compose.prod.yml up -d --no-deps builder worker realtime

# 5. Limpar imagens antigas órfãs
docker image prune -f
```

---

## 7. Estratégia de Backup e Disaster Recovery (DR)

### Script Diário de Backup do Banco (`/opt/backup-chatbotx.sh`):

```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/backups/chatbotx"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

echo "Iniciando backup em $TIMESTAMP..."

# 1. Dump do PostgreSQL comprimido
docker compose -f /opt/chatbotx/docker-compose.prod.yml exec -T postgres pg_dump -U chatbotx -d chatbotx -Fc > "$BACKUP_DIR/db_$TIMESTAMP.dump"

# 2. Backup do volume de dados do Whatsmeow
tar -czf "$BACKUP_DIR/whatsmeow_$TIMESTAMP.tar.gz" -C /var/lib/docker/volumes/chatbotx-prod_whatsmeow-data/_data .

# 3. Rotação: Manter os últimos 7 dias de backup local
find "$BACKUP_DIR" -type f -mtime +7 -delete

echo "Backup concluído com sucesso em $BACKUP_DIR"
```

Configure no cron (`crontab -e`):
```cron
0 3 * * * /opt/backup-chatbotx.sh >> /var/log/chatbotx-backup.log 2>&1
```

---

## 8. Monitoramento e Saúde do Sistema (Healthchecks)

Monitore os seguintes endpoints via UptimeRobot, Prometheus ou Zabbix:

- **Web & API:** `GET https://app.seudominio.com.br/api/health` → Retorna HTTP 200 `{ status: "healthy", service: "builder" }`.
- **Gateway Realtime:** `GET https://app.seudominio.com.br/ws/health` → Retorna HTTP 200 `ok`.
- **Sandbox JavaScript:** Endpoint interno `http://javascript-executor:3210/health` → Retorna HTTP 200 `ok`.
- **Filas BullMQ:** Acesse pelo painel logado `/developer/queues` para auditar a taxa de consumo, erros ou filas presas.
