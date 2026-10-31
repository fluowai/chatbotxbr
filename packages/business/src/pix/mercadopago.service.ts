/**
 * Mercado Pago API Integration (PIX Checkout Brasil)
 */

import { getChildLogger } from "@chatbotx.io/logger"
import { createId } from "@chatbotx.io/utils"

const logger = getChildLogger("mercadopago-service")

export type MercadoPagoPayerInput = {
  email: string
  firstName?: string
  lastName?: string
  identification?: {
    type: "CPF" | "CNPJ"
    number: string
  }
}

export type MercadoPagoPixChargeInput = {
  transactionAmount: number
  description: string
  payer: MercadoPagoPayerInput
  externalReference?: string
  notificationUrl?: string
}

export type MercadoPagoPixResponse = {
  id: number
  status: string // pending, approved, authorized, in_process, in_mediation, rejected, cancelled, refunded, charged_back
  statusDetail: string
  payload: string // Copia e Cola
  qrCodeBase64: string // Base64 PNG
  ticketUrl: string
  dateOfExpiration: string
}

export class MercadoPagoService {
  private get accessToken(): string {
    return process.env.MERCADOPAGO_ACCESS_TOKEN || ""
  }

  private get baseUrl(): string {
    return "https://api.mercadopago.com/v1"
  }

  public isConfigured(): boolean {
    return Boolean(this.accessToken)
  }

  /**
   * Creates a PIX payment via Mercado Pago.
   */
  public async createPixPayment(
    input: MercadoPagoPixChargeInput,
  ): Promise<MercadoPagoPixResponse | null> {
    if (!this.isConfigured()) return null

    try {
      const idempotencyKey = createId()

      const res = await fetch(`${this.baseUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: input.transactionAmount,
          description: input.description,
          payment_method_id: "pix",
          external_reference: input.externalReference,
          notification_url: input.notificationUrl,
          payer: {
            email: input.payer.email,
            first_name: input.payer.firstName,
            last_name: input.payer.lastName,
            identification: input.payer.identification
              ? {
                  type: input.payer.identification.type,
                  number: input.payer.identification.number.replace(/\D/g, ""),
                }
              : undefined,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        logger.error({ err }, "Failed to create Mercado Pago Pix payment")
        return null
      }

      const data = await res.json()
      const txData = data.point_of_interaction?.transaction_data

      return {
        id: data.id,
        status: data.status,
        statusDetail: data.status_detail,
        payload: txData?.qr_code || "",
        qrCodeBase64: txData?.qr_code_base64 || "",
        ticketUrl: txData?.ticket_url || "",
        dateOfExpiration: data.date_of_expiration || "",
      }
    } catch (err) {
      logger.error({ err }, "Error in MercadoPago createPixPayment")
      return null
    }
  }

  /**
   * Retrieves current payment details from Mercado Pago.
   */
  public async getPayment(paymentId: string | number): Promise<{
    id: number
    status: string
    statusDetail: string
    externalReference: string
  } | null> {
    if (!this.isConfigured()) return null

    try {
      const res = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      if (!res.ok) return null
      const data = await res.json()
      return {
        id: data.id,
        status: data.status,
        statusDetail: data.status_detail,
        externalReference: data.external_reference,
      }
    } catch (err) {
      logger.error({ err }, "Error in MercadoPago getPayment")
      return null
    }
  }
}

export const mercadoPagoService = new MercadoPagoService()
