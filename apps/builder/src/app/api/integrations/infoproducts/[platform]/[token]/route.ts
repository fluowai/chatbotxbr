import { infoproductService } from "@chatbotx.io/business"
import { toLoggableDatabaseError } from "@chatbotx.io/database/client"
import { type NextRequest, NextResponse } from "next/server"
import { INBOUND_WEBHOOK_ERROR_CODE } from "@/features/inbound-webhooks/lib/error-codes"
import { handleInboundWebhookRequest } from "@/features/inbound-webhooks/lib/handle-inbound-request"
import { logger } from "@/lib/log"

type RouteContext = {
  params: Promise<{
    platform: string
    token: string
  }>
}

const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { platform, token } = await context.params

    let rawJson: Record<string, any> = {}
    try {
      rawJson = await request.clone().json()
    } catch {
      rawJson = {}
    }

    // Normaliza o payload brasileiro específico da plataforma (Kiwify, Hotmart, Eduzz, etc)
    const normalized = infoproductService.parseWebhook(platform, rawJson)

    // Cria payload enriquecido com campos padronizados acessíveis diretamente por qualquer fluxo
    const enrichedPayload = {
      ...rawJson,
      _normalized: normalized,
      platform: normalized.platform,
      event_type: normalized.eventType,
      transaction_id: normalized.transactionId,
      customer: {
        name: normalized.customer.name,
        email: normalized.customer.email,
        phone: normalized.customer.phone,
        mobile: normalized.customer.phone,
        document: normalized.customer.document,
        city: normalized.customer.city,
        state: normalized.customer.state,
      },
      product: normalized.product,
      payment: normalized.payment,
    }

    const headers = new Headers(request.headers)
    headers.set("content-type", "application/json")

    const syntheticRequest = new Request(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify(enrichedPayload),
    })

    const { status, body, headers: responseHeaders } =
      await handleInboundWebhookRequest({
        token,
        request: syntheticRequest,
      })

    return NextResponse.json(
      {
        ...body,
        platform: normalized.platform,
        event: normalized.eventType,
        normalizedCustomer: normalized.customer,
      },
      {
        status,
        headers: { ...NO_STORE, ...responseHeaders },
      },
    )
  } catch (err) {
    logger.error(
      { err: toLoggableDatabaseError(err) },
      "Infoproduct webhook processing failed",
    )
    return NextResponse.json(
      {
        accepted: false,
        code: INBOUND_WEBHOOK_ERROR_CODE.systemError,
        message: "Failed to process infoproduct webhook",
      },
      { status: 500, headers: NO_STORE },
    )
  }
}

const methodNotAllowed = () =>
  new NextResponse(null, {
    status: 405,
    headers: { Allow: "POST", ...NO_STORE },
  })

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
export const OPTIONS = methodNotAllowed
