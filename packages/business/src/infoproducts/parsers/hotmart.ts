import { formatCPF, normalizeBrazilianPhone } from "@chatbotx.io/utils"
import type { NormalizedEventType, NormalizedInfoproductEvent } from "../types"

export function parseHotmartWebhook(
  payload: Record<string, any>,
): NormalizedInfoproductEvent {
  const event = (payload.event || "").toUpperCase()
  const data = payload.data || payload

  let eventType: NormalizedEventType = "outro"
  if (
    event.includes("APPROVED") ||
    event.includes("COMPLETE") ||
    event.includes("APROVADA")
  ) {
    eventType = "compra_aprovada"
  } else if (
    event.includes("BILLET_PRINTED") ||
    event.includes("WAITING_PAYMENT")
  ) {
    eventType =
      data.purchase?.payment?.type === "PIX" ? "pix_gerado" : "aguardando_pagamento"
  } else if (event.includes("OUT_OF_SHOPPING_CART") || event.includes("ABANDON")) {
    eventType = "carrinho_abandonado"
  } else if (event.includes("REFUNDED") || event.includes("REEMBOLS")) {
    eventType = "reembolsado"
  } else if (event.includes("CHARGEBACK") || event.includes("ESTORNO")) {
    eventType = "estorno"
  } else if (event.includes("CANCELED") || event.includes("CANCELAD")) {
    eventType = "cancelado"
  }

  const buyer = data.buyer || {}
  const product = data.product || {}
  const purchase = data.purchase || {}
  const payment = purchase.payment || {}

  const rawPhone = buyer.checkout_phone || buyer.phone || ""
  const phone = normalizeBrazilianPhone(rawPhone) || rawPhone

  const rawDoc = buyer.document || ""
  const document = rawDoc ? formatCPF(rawDoc) : undefined

  let paymentMethod: "pix" | "credit_card" | "billet" | "other" = "other"
  const rawType = (payment.type || "").toUpperCase()
  if (rawType.includes("PIX")) {
    paymentMethod = "pix"
  } else if (rawType.includes("CARD") || rawType.includes("CREDIT")) {
    paymentMethod = "credit_card"
  } else if (rawType.includes("BILLET") || rawType.includes("BOLETO")) {
    paymentMethod = "billet"
  }

  const amount = purchase.price?.value || data.price?.value || 0

  return {
    platform: "hotmart",
    eventType,
    rawEvent: event,
    transactionId: String(
      purchase.transaction || data.transaction || `hotmart_${Date.now()}`,
    ),
    customer: {
      name: buyer.name || "Cliente Hotmart",
      email: buyer.email || "",
      phone,
      document,
      city: buyer.address?.city,
      state: buyer.address?.state,
    },
    product: {
      id: String(product.id || product.ucode || "0"),
      name: product.name || "Produto Hotmart",
    },
    payment: {
      method: paymentMethod,
      amount,
      currency: purchase.price?.currency_value || "BRL",
      pixCode: payment.pix_code || undefined,
      pixQrCodeUrl: payment.pix_qrcode || undefined,
      billetUrl: payment.billet_url || undefined,
      billetBarcode: payment.billet_barcode || undefined,
      installments: payment.installments_number || 1,
      paidAt: purchase.approved_date ? new Date(purchase.approved_date) : undefined,
    },
    createdAt: new Date(),
    rawPayload: payload,
  }
}
