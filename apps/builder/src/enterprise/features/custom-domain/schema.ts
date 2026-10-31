import { z } from "zod"

export const upsertCustomDomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(3, "Domínio muito curto")
    .max(253, "Domínio muito longo")
    .regex(
      /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      "Formato de domínio inválido (ex: app.suaempresa.com.br)",
    ),
})

export type UpsertCustomDomainSchema = z.infer<typeof upsertCustomDomainSchema>

export const deleteCustomDomainSchema = z.object({
  id: z.string(),
})

export const verifyCustomDomainSchema = z.object({
  id: z.string(),
})
