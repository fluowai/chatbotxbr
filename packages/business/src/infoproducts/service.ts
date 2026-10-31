import { parseEduzzWebhook } from "./parsers/eduzz"
import { parseGenericBrazilianWebhook } from "./parsers/generic-brazilian"
import { parseHotmartWebhook } from "./parsers/hotmart"
import { parseKiwifyWebhook } from "./parsers/kiwify"
import { parseMonetizzeWebhook } from "./parsers/monetizze"
import type { InfoproductPlatform, NormalizedInfoproductEvent } from "./types"

export class InfoproductService {
  readonly supportedPlatforms: InfoproductPlatform[] = [
    "kiwify",
    "hotmart",
    "eduzz",
    "monetizze",
    "braip",
    "ticto",
    "kirvano",
  ]

  parseWebhook(
    platform: string,
    payload: Record<string, any>,
  ): NormalizedInfoproductEvent {
    const normalizedPlatform = platform.toLowerCase().trim() as InfoproductPlatform

    switch (normalizedPlatform) {
      case "kiwify":
        return parseKiwifyWebhook(payload)
      case "hotmart":
        return parseHotmartWebhook(payload)
      case "eduzz":
        return parseEduzzWebhook(payload)
      case "monetizze":
        return parseMonetizzeWebhook(payload)
      case "braip":
      case "ticto":
      case "kirvano":
        return parseGenericBrazilianWebhook(normalizedPlatform, payload)
      default:
        return parseGenericBrazilianWebhook(
          (normalizedPlatform as InfoproductPlatform) || "kiwify",
          payload,
        )
    }
  }
}

export const infoproductService = new InfoproductService()
