/**
 * Asaas Fintech API Integration (PIX & Cobranças Brasil)
 */

import { getChildLogger } from "@chatbotx.io/logger"

const logger = getChildLogger("asaas-service")

export type AsaasCustomerInput = {
  name: string
  cpfCnpj?: string
  email?: string
  mobilePhone?: string
}

export type AsaasPixChargeInput = {
  customerId: string
  value: number
  description?: string
  dueDate?: string // YYYY-MM-DD
  externalReference?: string
}

export type AsaasPixQrCodeResponse = {
  encodedImage: string // Base64 PNG image
  payload: string // Copia e Cola
  expirationDate: string
}

export type AsaasPaymentStatus =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "DELETED"

export class AsaasService {
  private get apiKey(): string {
    return process.env.ASAAS_API_KEY || ""
  }

  private get baseUrl(): string {
    const isSandbox =
      process.env.ASAAS_ENVIRONMENT === "sandbox" ||
      process.env.NODE_ENV !== "production"
    return isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3"
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      access_token: this.apiKey,
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey)
  }

  /**
   * Find or create a customer in Asaas by CPF/CNPJ or email.
   */
  public async getOrCreateCustomer(
    input: AsaasCustomerInput,
  ): Promise<string | null> {
    if (!this.isConfigured()) return null

    try {
      // Check if customer already exists by cpfCnpj or email
      if (input.cpfCnpj || input.email) {
        const query = new URLSearchParams()
        if (input.cpfCnpj) query.set("cpfCnpj", input.cpfCnpj.replace(/\D/g, ""))
        else if (input.email) query.set("email", input.email)

        const searchRes = await fetch(`${this.baseUrl}/customers?${query.toString()}`, {
          method: "GET",
          headers: this.headers,
        })

        if (searchRes.ok) {
          const searchData = await searchRes.json()
          if (searchData.data && searchData.data.length > 0) {
            return searchData.data[0].id
          }
        }
      }

      // Create customer
      const createRes = await fetch(`${this.baseUrl}/customers`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          name: input.name,
          cpfCnpj: input.cpfCnpj ? input.cpfCnpj.replace(/\D/g, "") : undefined,
          email: input.email,
          mobilePhone: input.mobilePhone
            ? input.mobilePhone.replace(/\D/g, "")
            : undefined,
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.text()
        logger.error({ err }, "Failed to create Asaas customer")
        return null
      }

      const createData = await createRes.json()
      return createData.id
    } catch (err) {
      logger.error({ err }, "Error in Asaas getOrCreateCustomer")
      return null
    }
  }

  /**
   * Creates a PIX charge in Asaas and retrieves its Copia e Cola and QR Code.
   */
  public async createPixCharge(input: AsaasPixChargeInput): Promise<{
    paymentId: string
    payload: string
    qrCodeBase64: string
    expirationDate: string
  } | null> {
    if (!this.isConfigured()) return null

    try {
      const today = new Date().toISOString().split("T")[0]
      const dueDate = input.dueDate || today

      const res = await fetch(`${this.baseUrl}/payments`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          customer: input.customerId,
          billingType: "PIX",
          value: input.value,
          dueDate,
          description: input.description,
          externalReference: input.externalReference,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        logger.error({ err }, "Failed to create Asaas payment charge")
        return null
      }

      const payment = await res.json()
      const paymentId = payment.id

      // Fetch the PIX QR Code & Copia e Cola
      const qrRes = await fetch(
        `${this.baseUrl}/payments/${paymentId}/pixQrCode`,
        {
          method: "GET",
          headers: this.headers,
        },
      )

      if (!qrRes.ok) {
        const err = await qrRes.text()
        logger.error({ err }, "Failed to fetch Asaas Pix QR Code")
        return null
      }

      const qrData: AsaasPixQrCodeResponse = await qrRes.json()

      return {
        paymentId,
        payload: qrData.payload,
        qrCodeBase64: qrData.encodedImage,
        expirationDate: qrData.expirationDate,
      }
    } catch (err) {
      logger.error({ err }, "Error in Asaas createPixCharge")
      return null
    }
  }

  /**
   * Retrieves current status of an Asaas payment.
   */
  public async getPaymentStatus(
    paymentId: string,
  ): Promise<AsaasPaymentStatus | null> {
    if (!this.isConfigured()) return null

    try {
      const res = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        method: "GET",
        headers: this.headers,
      })

      if (!res.ok) return null
      const data = await res.json()
      return data.status as AsaasPaymentStatus
    } catch (err) {
      logger.error({ err }, "Error in Asaas getPaymentStatus")
      return null
    }
  }
}

export const asaasService = new AsaasService()
