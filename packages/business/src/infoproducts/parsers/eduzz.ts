import { formatCPF, normalizeBrazilianPhone } from "@chatbotx.io/utils"
import type { NormalizedEventType, NormalizedInfoproductEvent } from "../types"

export function parseEduzzWebhook(
  payload: Record<string, any>,
): NormalizedInfoproductEvent {
  const rawStatus = (
    payload.trans_status ||
    payload.status ||
    payload.event ||
    ""
  ).toString().toLowerCase()

  let eventType: NormalizedEventType = "outro"
  // Eduzz statuses: 3 = Paga/Aprovada, 1 = Aberta (aguardando), 4 = Cancelada, 6 = Reembolsada, 7 = Disputa/Chargeback
  if (
    rawStatus === "3" ||
    rawStatus.includes("paga") ||
    rawStatus.includes("aprovad") ||
    rawStatus.includes("paid")
  ) {
    eventType = "compra_aprovada"
  } else if (
    rawStatus === "1" ||
    rawStatus.includes("aberta") ||
    rawStatus.includes("aguard")
  ) {
    eventType =
      payload.trans_paymentmethod === "pix" ? "pix_gerado" : "aguardando_pagamento"
  } else if (rawStatus.includes("abandon") || rawStatus.includes("carrinho")) {
    eventType = "carrinho_abandonado"
  } else if (
    rawStatus === "6" ||
    rawStatus.includes("reembols") ||
    rawStatus.includes("refund")
  ) {
    eventType = "reembolsado"
  } else if (
    rawStatus === "7" ||
    rawStatus.includes("disputa") ||
    rawStatus.includes("chargeback")
  ) {
    eventType = "estorno"
  } else if (
    rawStatus === "4" ||
    rawStatus.includes("cancel")
  ) {
    eventType = "cancelado"
  }

  const rawPhone =
    payload.cus_cel ||
    payload.cus_tel ||
    payload.customer_phone ||
    payload.phone ||
    ""
  const phone = normalizeBrazilianPhone(rawPhone) || rawPhone

  const rawDoc = payload.cus_taxnumber || payload.customer_document || ""
  const document = rawDoc ? formatCPF(rawDoc) : undefined

  let paymentMethod: "pix" | "credit_card" | "billet" | "other" = "other"
  const rawMethod = (
    payload.trans_paymentmethod ||
    payload.payment_method ||
    ""
  ).toLowerCase()
  if (rawMethod.includes("pix")) {
    paymentMethod = "pix"
  } else if (rawMethod.includes("card") || rawMethod.includes("credito") || rawMethod.includes("cc")) {
    paymentMethod = "credit_card"
  } else if (rawMethod.includes("boleto") || rawMethod.includes("billet")) {
    paymentMethod = "billet"
  }

  const amount = Number(payload.trans_value || payload.amount || 0)

  return {
    platform: "eduzz",
    eventType,
    rawEvent: rawStatus,
    transactionId: String(
      payload.trans_cod || payload.trans_id || `eduzz_${Date.now()}`,
    ),
    customer: {
      name: payload.cus_name || payload.customer_name || "Cliente Eduzz",
      email: payload.cus_email || payload.customer_email || "",
      phone,
      document,
      city: payload.cus_city,
      state: payload.cus_state,
    },
    product: {
      id: String(payload.pro_cod || payload.product_id || "0"),
      name: payload.pro_name || payload.product_name || "Produto Eduzz",
    },
    payment: {
      method: paymentMethod,
      amount,
      currency: "BRL",
      pixCode: payload.pix_qrcode || payload.pix_code || undefined,
      billetUrl: payload.trans_billet_url || undefined,
      billetBarcode: payload.trans_barcode || undefined,
      installments: Number(payload.trans_installments || 1),
      paidAt: payload.trans_paid ? new Date(payload.trans_paid) : undefined,
    },
    createdAt: new Date(),
    rawPayload: payload,
  }
}
