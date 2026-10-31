/**
 * Banco Central do Brasil - Especificação do PIX Copia e Cola / QR Code Estático (EMVCo)
 */

/**
 * Normalizes text to ASCII by removing accents and special characters.
 */
function normalizeText(text: string, maxLength: number): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .slice(0, maxLength)
}

/**
 * Format a TLV (Tag-Length-Value) field according to EMVCo standards.
 */
function formatTLV(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, "0")
  return `${tag}${length}${value}`
}

/**
 * Calculates the CRC16-CCITT checksum (polynomial 0x1021, init 0xFFFF).
 */
export function calculateCRC16(payload: string): string {
  let crc = 0xffff
  const polynomial = 0x1021

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }

  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0")
}

export type StaticPixOptions = {
  /**
   * Chave PIX (CPF, CNPJ, E-mail, Celular com +55 ou EVP/Chave Aleatória).
   */
  key: string
  /**
   * Nome do beneficiário (até 25 caracteres).
   */
  merchantName: string
  /**
   * Cidade do beneficiário (até 15 caracteres).
   */
  merchantCity: string
  /**
   * Valor em reais (opcional; se omitido ou 0, o pagador digita o valor).
   */
  amount?: number
  /**
   * Identificador da transação (txid; até 25 caracteres, alfanumérico). Padrão: "***".
   */
  txid?: string
  /**
   * Descrição ou mensagem adicional (opcional).
   */
  description?: string
}

export type StaticPixResult = {
  /**
   * String completa do PIX Copia e Cola (padrão EMVCo com CRC16).
   */
  payload: string
  /**
   * Link para renderização do QR Code em imagem SVG/PNG pública.
   */
  qrCodeUrl: string
}

/**
 * Generates a standard Banco Central do Brasil PIX Copia e Cola / BR Code string.
 */
export function generatePixPayload(options: StaticPixOptions): StaticPixResult {
  const { key, merchantName, merchantCity, amount, txid, description } = options

  // Payload Format Indicator
  let payload = formatTLV("00", "01")

  // Merchant Account Information (Tag 26)
  let accountInfo = formatTLV("00", "br.gov.bcb.pix")
  accountInfo += formatTLV("01", key.trim())
  if (description) {
    accountInfo += formatTLV("02", normalizeText(description, 40))
  }
  payload += formatTLV("26", accountInfo)

  // Merchant Category Code (Tag 52)
  payload += formatTLV("52", "0000")

  // Transaction Currency (Tag 53 - 986 = BRL)
  payload += formatTLV("53", "986")

  // Transaction Amount (Tag 54)
  if (amount != null && amount > 0) {
    payload += formatTLV("54", amount.toFixed(2))
  }

  // Country Code (Tag 58)
  payload += formatTLV("58", "BR")

  // Merchant Name (Tag 59 - max 25 chars)
  const cleanName = normalizeText(merchantName || "Recebedor", 25)
  payload += formatTLV("59", cleanName)

  // Merchant City (Tag 60 - max 15 chars)
  const cleanCity = normalizeText(merchantCity || "SAO PAULO", 15)
  payload += formatTLV("60", cleanCity)

  // Additional Data Field Template (Tag 62)
  const cleanTxid = txid ? normalizeText(txid, 25) : "***"
  const additionalData = formatTLV("05", cleanTxid || "***")
  payload += formatTLV("62", additionalData)

  // CRC16 Checksum (Tag 63)
  const payloadToSign = `${payload}6304`
  const checksum = calculateCRC16(payloadToSign)
  const finalPayload = `${payloadToSign}${checksum}`

  // Public QR Code generation URL using quickchart / standard renderer
  const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(finalPayload)}&size=300&margin=2`

  return {
    payload: finalPayload,
    qrCodeUrl,
  }
}
