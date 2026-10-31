import { formatCPF, normalizeBrazilianPhone } from "@chatbotx.io/utils"
import type { NormalizedEventType, NormalizedInfoproductEvent } from "../types"

export function parseKiwifyWebhook(
  payload: Record<string, any>,
): NormalizedInfoproductEvent {
  const rawStatus = (
    payload.order_status ||
    payload.event ||
    payload.status ||
    ""
  ).toLowerCase()

  let eventType: NormalizedEventType = "outro"
  if (
    rawStatus.includes("paid") ||
    rawStatus.includes("approved") ||
    rawStatus.includes("order_approved")
  ) {
    eventType = "compra_aprovada"
  } else if (
    rawStatus.includes("pix_generated") ||
    (payload.PaymentMethod === "pix" && rawStatus.includes("waiting_payment"))
  ) {
    eventType = "pix_gerado"
  } else if (
    rawStatus.includes("waiting_payment") ||
    rawStatus.includes("pending")
  ) {
    eventType = "aguardando_pagamento"
  } else if (
    rawStatus.includes("abandoned") ||
    rawStatus.includes("carrinho_abandonado")
  ) {
    eventType = "carrinho_abandonado"
  } else if (rawStatus.includes("refunded") || rawStatus.includes("reembols")) {
    eventType = "reembolsado"
  } else if (
    rawStatus.includes("chargedback") ||
    rawStatus.includes("chargeback")
  ) {
    eventType = "estorno"
  } else if (
    rawStatus.includes("canceled") ||
    rawStatus.includes("cancelado")
  ) {
    eventType = "cancelado"
  }

  const customerObj = payload.Customer || payload.customer || {}
  const productObj = payload.Product || payload.product || {}
  const rawPhone =
    customerObj.mobile || customerObj.phone || payload.phone || ""
  const phone = normalizeBrazilianPhone(rawPhone) || rawPhone

  const rawCpf = customerObj.CPF || customerObj.cpf || customerObj.document || ""
  const document = rawCpf ? formatCPF(rawCpf) : undefined

  let paymentMethod: "pix" | "credit_card" | "billet" | "other" = "other"
  const rawMethod = (
    payload.PaymentMethod ||
    payload.payment_method ||
    ""
  ).toLowerCase()
  if (rawMethod.includes("pix")) {
    paymentMethod = "pix"
  } else if (rawMethod.includes("card") || rawMethod.includes("credito")) {
    paymentMethod = "credit_card"
  } else if (rawMethod.includes("boleto") || rawMethod.includes("billet")) {
    paymentMethod = "billet"
  }

  const rawAmount =
    payload.order_amount || payload.order_value || payload.amount || 0
  const amount =
    typeof rawAmount === "number"
      ? rawAmount > 1000 && !Number.isInteger(rawAmount)
        ? rawAmount
        : rawAmount / 100 > 1 && Number.isInteger(rawAmount)
          ? rawAmount / 100
          : rawAmount
      : Number(rawAmount) || 0

  return {
    platform: "kiwify",
    eventType,
    rawEvent: rawStatus,
    transactionId: String(
      payload.order_id || payload.id || `kiwify_${Date.now()}`,
    ),
    customer: {
      name:
        customerObj.full_name ||
        customerObj.first_name ||
        customerObj.name ||
        "Cliente Kiwify",
      email: customerObj.email || "",
      phone,
      document,
      city: customerObj.city,
      state: customerObj.state,
    },
    product: {
      id: String(productObj.product_id || productObj.id || "0"),
      name: productObj.product_name || productObj.name || "Produto Kiwify",
      offerId: payload.offer_id || undefined,
    },
    payment: {
      method: paymentMethod,
      amount,
      currency: "BRL",
      pixCode: payload.pix_code || payload.pix_payload || undefined,
      pixQrCodeUrl: payload.pix_qr_code || undefined,
      billetUrl: payload.boleto_URL || payload.boleto_url || undefined,
      billetBarcode: payload.boleto_barcode || undefined,
      installments: payload.installments || 1,
      paidAt: payload.paid_at ? new Date(payload.paid_at) : undefined,
    },
    createdAt: new Date(),
    rawPayload: payload,
  }
}
