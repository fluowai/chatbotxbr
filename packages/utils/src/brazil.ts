/**
 * Brazilian Localization Utilities
 * CPF, CNPJ, Telefone e Moeda (BRL)
 */

/**
 * Remove all non-numeric characters from a string.
 */
export const cleanDigits = (value: string | null | undefined): string => {
  if (!value) return ""
  return value.replace(/\D/g, "")
}

/**
 * Validates a Brazilian CPF (Cadastro de Pessoas Físicas) using verification digits.
 */
export const validateCPF = (cpf: string | null | undefined): boolean => {
  const digits = cleanDigits(cpf)
  if (digits.length !== 11) return false

  // Reject sequences with all identical digits (e.g. "11111111111")
  if (/^(\d)\1{10}$/.test(digits)) return false

  // Validate 1st check digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += Number.parseInt(digits[i], 10) * (10 - i)
  }
  let rest = (sum * 10) % 11
  if (rest === 10 || rest === 11) rest = 0
  if (rest !== Number.parseInt(digits[9], 10)) return false

  // Validate 2nd check digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += Number.parseInt(digits[i], 10) * (11 - i)
  }
  rest = (sum * 10) % 11
  if (rest === 10 || rest === 11) rest = 0
  if (rest !== Number.parseInt(digits[10], 10)) return false

  return true
}

/**
 * Validates a Brazilian CNPJ (Cadastro Nacional da Pessoa Jurídica) using verification digits.
 */
export const validateCNPJ = (cnpj: string | null | undefined): boolean => {
  const digits = cleanDigits(cnpj)
  if (digits.length !== 14) return false

  // Reject sequences with all identical digits
  if (/^(\d)\1{13}$/.test(digits)) return false

  const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weightsSecond = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  // Validate 1st check digit
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += Number.parseInt(digits[i], 10) * weightsFirst[i]
  }
  let rest = sum % 11
  const digit1 = rest < 2 ? 0 : 11 - rest
  if (digit1 !== Number.parseInt(digits[12], 10)) return false

  // Validate 2nd check digit
  sum = 0
  for (let i = 0; i < 13; i++) {
    sum += Number.parseInt(digits[i], 10) * weightsSecond[i]
  }
  rest = sum % 11
  const digit2 = rest < 2 ? 0 : 11 - rest
  if (digit2 !== Number.parseInt(digits[13], 10)) return false

  return true
}

/**
 * Validates either a CPF (11 digits) or CNPJ (14 digits).
 */
export const validateDocumentBR = (doc: string | null | undefined): boolean => {
  const digits = cleanDigits(doc)
  if (digits.length === 11) return validateCPF(digits)
  if (digits.length === 14) return validateCNPJ(digits)
  return false
}

/**
 * Formats an 11-digit CPF as "000.000.000-00".
 */
export const formatCPF = (cpf: string | null | undefined): string => {
  const digits = cleanDigits(cpf).padStart(11, "0").slice(0, 11)
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

/**
 * Formats a 14-digit CNPJ as "00.000.000/0000-00".
 */
export const formatCNPJ = (cnpj: string | null | undefined): string => {
  const digits = cleanDigits(cnpj).padStart(14, "0").slice(0, 14)
  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5",
  )
}

/**
 * Formats either CPF or CNPJ based on digit count.
 */
export const formatDocumentBR = (doc: string | null | undefined): string => {
  const digits = cleanDigits(doc)
  if (digits.length <= 11) return formatCPF(digits)
  return formatCNPJ(digits)
}

/**
 * Normalizes Brazilian phone numbers into standard E.164 format (+55DD9XXXXXXXX).
 * Automatically inserts the 9th digit for mobile numbers if omitted.
 */
export const normalizeBrazilianPhone = (
  phone: string | null | undefined,
): string => {
  let digits = cleanDigits(phone)
  if (!digits) return ""

  // Strip leading national prefix "0" if present (e.g. 011999999999 -> 11999999999)
  if (digits.startsWith("0")) {
    digits = digits.slice(1)
  }

  // Strip country code 55 if already included to normalize local representation
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2)
  }

  // 10 digits: DDD + 8 digits (old mobile or landline)
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2)
    const firstDigit = digits[2]
    // If it's a mobile prefix (6, 7, 8, 9), inject 9
    if (["6", "7", "8", "9"].includes(firstDigit)) {
      digits = `${ddd}9${digits.slice(2)}`
    }
  }

  // Now digits should be 10 (landline) or 11 (mobile)
  return `+55${digits}`
}

/**
 * Formats a phone number for user display: "(11) 99999-9999" or "+55 (11) 99999-9999".
 */
export const formatBrazilianPhone = (
  phone: string | null | undefined,
  includeCountryCode = false,
): string => {
  const e164 = normalizeBrazilianPhone(phone)
  const digits = cleanDigits(e164).slice(2) // remove 55

  if (digits.length === 11) {
    const formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    return includeCountryCode ? `+55 ${formatted}` : formatted
  }

  if (digits.length === 10) {
    const formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
    return includeCountryCode ? `+55 ${formatted}` : formatted
  }

  return phone ?? ""
}

/**
 * Formats a numeric value into Brazilian Real: "R$ 1.250,50"
 */
export const formatCurrencyBRL = (amount: number | null | undefined): string => {
  if (amount == null || Number.isNaN(amount)) return "R$ 0,00"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount)
}
