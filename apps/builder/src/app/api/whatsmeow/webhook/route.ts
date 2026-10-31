import { toLoggableDatabaseError } from "@chatbotx.io/database/client"
import { normalizeBrazilianPhone } from "@chatbotx.io/utils"
import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/log"

const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.WHATSMEOW_SECRET
    if (secret) {
      const headerSecret = request.headers.get("X-Api-Secret")
      if (headerSecret !== secret) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: NO_STORE },
        )
      }
    }

    const payload = await request.json()
    const { sessionId, event, data, engine } = payload

    logger.info(
      { sessionId, event, from: data?.from },
      "whatsmeow: webhook received",
    )

    if (event === "message") {
      const rawFrom = String(data.from || "")
      const normalizedPhone = normalizeBrazilianPhone(rawFrom) || rawFrom
      const messageText = data.text || ""

      // Evento de mensagem recebida no WhatsApp via whatsmeow
      logger.info(
        {
          sessionId,
          from: normalizedPhone,
          textLength: messageText.length,
          isGroup: data.isGroup,
        },
        "whatsmeow: incoming message processed",
      )
    }

    return NextResponse.json(
      {
        received: true,
        sessionId,
        event,
      },
      { status: 200, headers: NO_STORE },
    )
  } catch (err) {
    logger.error(
      { err: toLoggableDatabaseError(err) },
      "whatsmeow: webhook processing error",
    )
    return NextResponse.json(
      { error: "Internal Error" },
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
