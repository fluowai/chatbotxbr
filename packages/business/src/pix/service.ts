/**
 * Unified PIX Service for ChatbotX
 * Supports Static Pix (EMVCo), Asaas and Mercado Pago
 */

import { getChildLogger } from "@chatbotx.io/logger"
import { asaasService } from "./asaas.service"
import { mercadoPagoService } from "./mercadopago.service"
import {
  generatePixPayload,
  type StaticPixOptions,
  type StaticPixResult,
} from "./pix-payload"

const logger = getChildLogger("pix-service")

export type CreatePixChargeOptions = {
  amount: number
  description: string
  customer: {
    name: string
    email?: string
    phone?: string
    cpfCnpj?: string
  }
  externalReference?: string
  preferredProvider?: "asaas" | "mercadopago" | "static"
  staticPixFallbackKey?: string
  staticMerchantName?: string
  staticMerchantCity?: string
}

export type PixChargeResult = {
  provider: "asaas" | "mercadopago" | "static"
  paymentId?: string
  payload: string // Copia e Cola
  qrCodeUrl?: string // URL to QR code image
  qrCodeBase64?: string // Base64 data if available
  expirationDate?: string
}

export class PixService {
  /**
   * Generates a standard Static Pix (EMVCo) Copia e Cola and QR Code.
   */
  public generateStaticPix(options: StaticPixOptions): StaticPixResult {
    return generatePixPayload(options)
  }

  /**
   * Status of available Pix payment providers.
   */
  public getProvidersStatus(): {
    asaas: boolean
    mercadopago: boolean
    static: boolean
  } {
    return {
      asaas: asaasService.isConfigured(),
      mercadopago: mercadoPagoService.isConfigured(),
      static: true,
    }
  }

  /**
   * Creates a Pix charge using the best available configured provider.
   */
  public async createCharge(
    options: CreatePixChargeOptions,
  ): Promise<PixChargeResult> {
    const { preferredProvider, amount, description, customer, externalReference } =
      options

    // 1. Try Mercado Pago if preferred or configured
    if (
      (preferredProvider === "mercadopago" || !preferredProvider) &&
      mercadoPagoService.isConfigured()
    ) {
      const mpResult = await mercadoPagoService.createPixPayment({
        transactionAmount: amount,
        description,
        externalReference,
        payer: {
          email: customer.email || "contato@cliente.com.br",
          firstName: customer.name.split(" ")[0] || "Cliente",
          lastName: customer.name.split(" ").slice(1).join(" ") || "Consumidor",
          identification: customer.cpfCnpj
            ? {
                type: customer.cpfCnpj.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ",
                number: customer.cpfCnpj,
              }
            : undefined,
        },
      })

      if (mpResult) {
        return {
          provider: "mercadopago",
          paymentId: String(mpResult.id),
          payload: mpResult.payload,
          qrCodeBase64: mpResult.qrCodeBase64,
          qrCodeUrl: `https://quickchart.io/qr?text=${encodeURIComponent(mpResult.payload)}&size=300`,
          expirationDate: mpResult.dateOfExpiration,
        }
      }
    }

    // 2. Try Asaas if preferred or configured
    if (
      (preferredProvider === "asaas" || !preferredProvider) &&
      asaasService.isConfigured()
    ) {
      const customerId = await asaasService.getOrCreateCustomer({
        name: customer.name,
        email: customer.email,
        mobilePhone: customer.phone,
        cpfCnpj: customer.cpfCnpj,
      })

      if (customerId) {
        const asaasResult = await asaasService.createPixCharge({
          customerId,
          value: amount,
          description,
          externalReference,
        })

        if (asaasResult) {
          return {
            provider: "asaas",
            paymentId: asaasResult.paymentId,
            payload: asaasResult.payload,
            qrCodeBase64: asaasResult.qrCodeBase64,
            qrCodeUrl: `https://quickchart.io/qr?text=${encodeURIComponent(asaasResult.payload)}&size=300`,
            expirationDate: asaasResult.expirationDate,
          }
        }
      }
    }

    // 3. Fallback to Static Pix
    const staticKey =
      options.staticPixFallbackKey ||
      process.env.DEFAULT_PIX_KEY ||
      "00000000000"
    const merchantName =
      options.staticMerchantName ||
      process.env.DEFAULT_PIX_NAME ||
      "Recebedor ChatbotX"
    const merchantCity =
      options.staticMerchantCity ||
      process.env.DEFAULT_PIX_CITY ||
      "SAO PAULO"

    logger.info("Using Static Pix generation fallback")

    const staticPix = generatePixPayload({
      key: staticKey,
      merchantName,
      merchantCity,
      amount,
      description,
      txid: externalReference?.slice(0, 25),
    })

    return {
      provider: "static",
      payload: staticPix.payload,
      qrCodeUrl: staticPix.qrCodeUrl,
    }
  }
}

export const pixService = new PixService()
