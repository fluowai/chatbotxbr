import { formatCPF, normalizeBrazilianPhone } from "@chatbotx.io/utils"
import type { InfoproductPlatform, NormalizedEventType, NormalizedInfoproductEvent } from "../types"

export function parseGenericBrazilianWebhook(
  platform: InfoproductPlatform,
  payload: Record<string, any>,
): NormalizedInfoproductEvent {
  const rawStatus = (
    payload.event ||
    payload.status ||
    payload.type ||
    payload.current_status ||
    ""
  ).toLowerCase()

  let eventType: NormalizedEventType = "outro"
  if (
    rawStatus.includes("paid") ||
    rawStatus.includes("approved") ||
    rawStatus.includes("pago") ||
    rawStatus.includes("aprovad") ||
    rawStatus.includes("complete")
  ) {
    eventType = "compra_aprovada"
  } else if (
    rawStatus.includes("pix") &&
    (rawStatus.includes("waiting") || rawStatus.includes("gerado"))
  ) {
    eventType = "pix_gerado"
  } else if (
    rawStatus.includes("waiting") ||
    rawStatus.includes("pendente") ||
    rawStatus.includes("aguard")
  ) {
    eventType = "aguardando_pagamento"
  } else if (
    rawStatus.includes("abandon") ||
    rawStatus.includes("carrinho")
  ) {
    eventType = "carrinho_abandonado"
  } else if (rawStatus.includes("refund") || rawStatus.includes("reembols")) {
    eventType = "reembolsado"
  } else if (rawStatus.includes("chargeback") || rawStatus.includes("estorno")) {
    eventType = "estorno"
  } else if (rawStatus.includes("cancel")) {
    eventType = "cancelado"
  }

  const customerObj =
    payload.customer ||
    payload.buyer ||
    payload.client ||
    payload.comprador ||
    payload.Customer ||
    {}

  const productObj =
    payload.product ||
    payload.item ||
    payload.produto ||
    payload.Product ||
    {}

  const rawPhone =
    customerObj.phone ||
    customerObj.mobile ||
    customerObj.cellphone ||
    customerObj.celular ||
    customerObj.telefone ||
    payload.phone ||
    ""
  const phone = normalizeBrazilianPhone(rawPhone) || rawPhone

  const rawDoc =
    customerObj.document ||
    customerObj.cpf ||
    customerObj.cnpj ||
    customerObj.tax_id ||
    ""
  const document = rawDoc ? formatCPF(rawDoc) : undefined

  let paymentMethod: "pix" | "credit_card" | "billet" | "other" = "other"
  const rawMethod = (
    payload.payment_method ||
    payload.payment_type ||
    payload.forma_pagamento ||
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
    payload.amount ||
    payload.total ||
    payload.price ||
    payload.valor ||
    payload.value ||
    0
  const amount = Number(rawAmount) || 0

  return {
    platform,
    eventType,
    rawEvent: rawStatus,
    transactionId: String(
      payload.transaction_id ||
        payload.order_id ||
        payload.id ||
        `${platform}_${Date.now()}`,
    ),
    customer: {
      name:
        customerObj.name ||
        customerObj.full_name ||
        customerObj.first_name ||
        `Cliente ${platform}`,
      email: customerObj.email || "",
      phone,
      document,
      city: customerObj.city || customerObj.cidade,
      state: customerObj.state || customerObj.estado,
    },
    product: {
      id: String(productObj.id || productObj.code || "0"),
      name: productObj.name || productObj.title || `Produto ${platform}`,
    },
    payment: {
      method: paymentMethod,
      amount,
      currency: "BRL",
      pixCode: payload.pix_code || payload.pix_copy_paste || undefined,
      pixQrCodeUrl: payload.pix_qrcode_url || undefined,
      billetUrl: payload.billet_url || payload.boleto_url || undefined,
      billetBarcode: payload.barcode || payload.linha_digitavel || undefined,
      installments: Number(payload.installments || 1),
    },
    createdAt: new Date(),
    rawPayload: payload,
  }
}
