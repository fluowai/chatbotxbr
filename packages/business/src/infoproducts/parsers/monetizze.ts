import { formatCPF, normalizeBrazilianPhone } from "@chatbotx.io/utils"
import type { NormalizedEventType, NormalizedInfoproductEvent } from "../types"

export function parseMonetizzeWebhook(
  payload: Record<string, any>,
): NormalizedInfoproductEvent {
  const dados = payload.dados || payload
  const rawStatus = (
    dados.status ||
    dados.tipoEvento ||
    payload.tipoEvento ||
    ""
  ).toLowerCase()

  let eventType: NormalizedEventType = "outro"
  if (
    rawStatus.includes("finalizada") ||
    rawStatus.includes("completa") ||
    rawStatus.includes("aprovad")
  ) {
    eventType = "compra_aprovada"
  } else if (
    rawStatus.includes("aguardando") ||
    rawStatus.includes("iniciada")
  ) {
    eventType =
      dados.formaPagamento === "PIX" ? "pix_gerado" : "aguardando_pagamento"
  } else if (rawStatus.includes("abandon") || rawStatus.includes("carrinho")) {
    eventType = "carrinho_abandonado"
  } else if (rawStatus.includes("reembols") || rawStatus.includes("devolvida")) {
    eventType = "reembolsado"
  } else if (rawStatus.includes("chargeback") || rawStatus.includes("disputa")) {
    eventType = "estorno"
  } else if (rawStatus.includes("cancelad")) {
    eventType = "cancelado"
  }

  const comprador = dados.comprador || payload.comprador || {}
  const produto = dados.produto || payload.produto || {}
  const venda = dados.venda || payload.venda || {}

  const rawPhone =
    comprador.telefone || comprador.celular || comprador.phone || ""
  const phone = normalizeBrazilianPhone(rawPhone) || rawPhone

  const rawDoc = comprador.cnpj_cpf || comprador.cpf || ""
  const document = rawDoc ? formatCPF(rawDoc) : undefined

  let paymentMethod: "pix" | "credit_card" | "billet" | "other" = "other"
  const rawMethod = (
    venda.formaPagamento ||
    dados.formaPagamento ||
    ""
  ).toLowerCase()
  if (rawMethod.includes("pix")) {
    paymentMethod = "pix"
  } else if (rawMethod.includes("cart") || rawMethod.includes("credito")) {
    paymentMethod = "credit_card"
  } else if (rawMethod.includes("boleto")) {
    paymentMethod = "billet"
  }

  const amount = Number(venda.valor || dados.valor || 0)

  return {
    platform: "monetizze",
    eventType,
    rawEvent: rawStatus,
    transactionId: String(
      venda.codigo || dados.codVenda || `monetizze_${Date.now()}`,
    ),
    customer: {
      name: comprador.nome || "Cliente Monetizze",
      email: comprador.email || "",
      phone,
      document,
      city: comprador.cidade,
      state: comprador.estado,
    },
    product: {
      id: String(produto.codigo || produto.id || "0"),
      name: produto.nome || "Produto Monetizze",
    },
    payment: {
      method: paymentMethod,
      amount,
      currency: "BRL",
      pixCode: venda.linha_digitavel || undefined,
      billetUrl: venda.linkBoleto || undefined,
      billetBarcode: venda.linha_digitavel || undefined,
      installments: Number(venda.parcelas || 1),
      paidAt: venda.dataFinalizada ? new Date(venda.dataFinalizada) : undefined,
    },
    createdAt: new Date(),
    rawPayload: payload,
  }
}
