export type InfoproductPlatform =
  | "kiwify"
  | "hotmart"
  | "eduzz"
  | "monetizze"
  | "braip"
  | "ticto"
  | "kirvano"

export type NormalizedEventType =
  | "compra_aprovada"
  | "pix_gerado"
  | "aguardando_pagamento"
  | "carrinho_abandonado"
  | "reembolsado"
  | "estorno"
  | "cancelado"
  | "outro"

export interface NormalizedCustomer {
  name: string
  email: string
  phone: string // Formato E.164 +55...
  document?: string // CPF ou CNPJ limpo ou formatado
  city?: string
  state?: string
}

export interface NormalizedProduct {
  id: string
  name: string
  offerId?: string
  offerName?: string
}

export interface NormalizedPayment {
  method: "pix" | "credit_card" | "billet" | "other"
  amount: number
  currency: string
  pixCode?: string
  pixQrCodeUrl?: string
  billetUrl?: string
  billetBarcode?: string
  installments?: number
  paidAt?: Date
}

export interface NormalizedInfoproductEvent {
  platform: InfoproductPlatform
  eventType: NormalizedEventType
  rawEvent: string
  transactionId: string
  customer: NormalizedCustomer
  product: NormalizedProduct
  payment: NormalizedPayment
  affiliate?: {
    id?: string
    name?: string
  }
  createdAt: Date
  rawPayload: Record<string, unknown>
}
