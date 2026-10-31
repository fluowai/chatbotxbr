# Manual de Tropicalização e Operação no Brasil — ChatbotX Marca Própria

Este documento é o guia definitivo para operar o **ChatbotX** no ecossistema brasileiro de marketing digital, e-commerce, infoprodutos e agências.

---

## 1. Moeda, Checkout e PIX Padrão

O sistema foi atualizado com suporte nativo à moeda brasileira e meios de pagamento nacionais:

- **Moeda Padrão**: `BRL` (Real Brasileiro).
- **Símbolo Padrão**: `R$ ` (com espaçamento padrão brasileiro).
- **País de Envio Padrão**: `BR` (Brasil).
- **Meios de Pagamento Nativos**: `PIX` e `Pagamento na entrega (cod)`.

### Como configurar no painel:
1. Acesse o seu workspace.
2. Vá em **E-commerce → Configurações → Pagamentos**.
3. Confirme que **BRL (R$)** está selecionado e a opção **PIX** está marcada como forma de pagamento ativa.

---

## 2. Gateways de Pagamento Integrados (Asaas & Mercado Pago)

O módulo `packages/business/src/pix/` fornece orquestração unificada de PIX com 3 modalidades:

| Provedor | Modalidade | Quando usar |
|---|---|---|
| **Mercado Pago** | Checkout Dinâmico Instantâneo | Ideal para checkout rápido de e-commerce e pagamentos imediatos com QR Code Base64. |
| **Asaas** | Gestão de Cobranças e Clientes | Líder no Brasil para agências, cobrança de mensalidades SaaS, carnês e clientes cadastrados por CPF/CNPJ. |
| **PIX Estático (BR Code)** | Chave Direta (EMVCo) | Sem intermediação nem taxas bancárias. O sistema gera a string EMVCo com CRC16 oficial do Banco Central. |

### Configuração no `.env`:
```env
# Asaas (Cobranças PIX)
ASAAS_API_KEY=$aact_seu_token_aqui
ASAAS_ENVIRONMENT=production # ou sandbox

# Mercado Pago (PIX Instantâneo)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-seu_token_aqui

# Fallback para Chave PIX Estática (Sem taxas de gateway)
DEFAULT_PIX_KEY=financeiro@suaempresa.com.br
DEFAULT_PIX_NAME="Sua Marca Propria"
DEFAULT_PIX_CITY="SAO PAULO"
```

---

## 3. Disparo Automático por Webhook (Kiwify, Hotmart, Eduzz, Monetizze, Braip, Ticto)

Você conta com **Conectores Dedicados em 1 Clique** para as principais plataformas de vendas do Brasil:

### URL do Webhook Dedicado em 1 Clique:
Basta copiar o token do seu Inbound Webhook (`iwh_xxxxxxxxxxxxxxx`) e usar a URL com o nome da sua plataforma:

- **Kiwify**: `https://app.seudominio.com.br/api/integrations/infoproducts/kiwify/iwh_xxxxxxxxxxxxxxx`
- **Hotmart**: `https://app.seudominio.com.br/api/integrations/infoproducts/hotmart/iwh_xxxxxxxxxxxxxxx`
- **Eduzz**: `https://app.seudominio.com.br/api/integrations/infoproducts/eduzz/iwh_xxxxxxxxxxxxxxx`
- **Monetizze**: `https://app.seudominio.com.br/api/integrations/infoproducts/monetizze/iwh_xxxxxxxxxxxxxxx`
- **Braip**: `https://app.seudominio.com.br/api/integrations/infoproducts/braip/iwh_xxxxxxxxxxxxxxx`
- **Ticto**: `https://app.seudominio.com.br/api/integrations/infoproducts/ticto/iwh_xxxxxxxxxxxxxxx`
- **Kirvano**: `https://app.seudominio.com.br/api/integrations/infoproducts/kirvano/iwh_xxxxxxxxxxxxxxx`

### Vantagens do Conector Nativo:
1. **Normalização Automática do Telefone**: Converte qualquer número brasileiro para `+55` com injeção automática do 9º dígito móvel.
2. **Eventos Padronizados**: O conector traduz os status da plataforma para eventos universais acessíveis no fluxo:
   - `compra_aprovada`: Envio de acesso/boas-vindas.
   - `pix_gerado`: Envio de código Pix Copia e Cola formatado + lembretes.
   - `carrinho_abandonado`: Mensagem empática de recuperação com cupom em 10 minutos.
   - `reembolsado` / `estorno`: Retirada de tags e bloqueio de acesso.

---

## 4. Conexão WhatsApp Não-Oficial com Whatsmeow (Golang)

Para operações que não desejam pagar taxas de conversa da Meta ou que precisam conectar números em 10 segundos via QR Code, o sistema inclui o microserviço nativo **Whatsmeow Bridge** em Golang (`apps/whatsmeow-bridge/`).

### Por que Whatsmeow?
- **Ultra-rápido e Leve**: Construído em Go puro (sem navegadores pesados como Puppeteer ou Chromium).
- **Consumo Mínimo de RAM**: Consome ~25MB de memória por container, suportando dezenas de conexões simultâneas.
- **Protocolo Multi-Device**: Conecta diretamente aos servidores oficiais do WhatsApp Web com criptografia ponta a ponta.

### Como Iniciar o Whatsmeow:
No arquivo `docker-compose.yml`, o serviço já está configurado. Basta subir o container:
```bash
docker compose up -d whatsmeow-bridge
```

### Endpoints da API Whatsmeow:
- `POST /session/create`: Inicializa a sessão para o workspace.
- `GET /session/qr?sessionId={id}`: Retorna o QR Code em Base64 e string pura para leitura na tela.
- `GET /session/status?sessionId={id}`: Consulta se a sessão está `CONNECTED` ou `QR_READY`.
- `POST /message/send`: Envio instantâneo de texto e links.
- `POST /api/whatsmeow/webhook`: Webhook no Next.js que recebe todas as mensagens e eventos em tempo real.

---

## 5. Modelos de Fluxo Prontos para Uso

Disponibilizamos 4 templates de fluxo JSON homologados na pasta `DEV/templates/`:

### Lista de Modelos:
1. `DEV/templates/fluxo-atendimento-ia-whatsapp.json`:
   - Triagem automática com IA, resposta a dúvidas frequentes, catálogo e transferência humana com desativação do bot.
2. `DEV/templates/fluxo-cobranca-pix-whatsapp.json`:
   - Envio de código PIX Copia e Cola formatado, instruções passo a passo para o cliente e botão de confirmação.
3. `DEV/templates/fluxo-recuperacao-pix-carrinho.json`:
   - Mensagem de recuperação empática com cupom de desconto exclusivo de 10% e opção de suporte direto.
4. `DEV/templates/fluxo-webhook-kiwify-hotmart.json`:
   - Boas-vindas para novos alunos/compradores, link de acesso à plataforma e convite para a comunidade VIP.

### Como importar um modelo:
1. No painel do ChatbotX, clique em **Automação → Fluxos**.
2. Clique no botão **Importar** (ícone de upload) no topo direito da tabela.
3. Arraste ou selecione o arquivo `.json` desejado da pasta `DEV/templates/`.
4. O fluxo será criado imediatamente e pronto para publicação ou edição visual no canvas!

---

## 6. Níveis de Assinatura (SaaS Tiers)

Disponíveis em `packages/business/src/billing/tiers.ts`:

| Nível | Preço Sugerido | WhatsApps | Contatos Ativos | Atendentes | Recursos |
|---|---|---|---|---|---|
| **Starter** | R$ 97/mês | 1 | 1.500 | 1 | Fluxos ilimitados, WhatsApp Oficial ou Whatsmeow |
| **Pro** | R$ 197/mês | 3 | 10.000 | 3 | Webhooks Kiwify/Hotmart, PIX Copia-e-Cola |
| **Scale** | R$ 397/mês | 10 | 50.000 | 10 | Agentes de IA, CRM Kanban, Transcrição de Áudio |
| **Agência** | R$ 697/mês | 50 | 200.000 | 50 | Domínio próprio, marca própria (White-Label) |
| **Enterprise** | R$ 1.497/mês | Ilimitado | Ilimitado | Ilimitado | Infraestrutura dedicada e suporte prioritário |

---

## 7. Validação de Dados Brasileiros e LGPD

O pacote `@chatbotx.io/utils` inclui os métodos:

```typescript
import { 
  validateCPF, 
  validateCNPJ, 
  validateDocumentBR, 
  formatCPF, 
  formatCNPJ, 
  normalizeBrazilianPhone, 
  formatBrazilianPhone, 
  formatCurrencyBRL 
} from "@chatbotx.io/utils"

// Normalização de telefone com 9º dígito automático
normalizeBrazilianPhone("11988887777") // -> "+5511988887777"
normalizeBrazilianPhone("1188887777")  // -> "+5511988887777" (injetou 9)

// Validação matemática de CPF e CNPJ
validateCPF("123.456.789-09") // -> true ou false

// Formatação BRL
formatCurrencyBRL(1250.5) // -> "R$ 1.250,50"
```

### Conformidade com a LGPD:
- Os termos de uso e política de privacidade padrão foram configurados para refletir a Lei Geral de Proteção de Dados (Lei 13.709/2018).
- O operador pode excluir e anonimizar dados de contatos a qualquer momento diretamente no painel de CRM.

