"use server"

import {
  assertEnterpriseFeatures,
  customDomainService,
  tenantService,
} from "@chatbotx.io/business"
import type { UserModel } from "@chatbotx.io/database/types"
import { platformAdminActionClient } from "@/lib/safe-action"
import {
  deleteCustomDomainSchema,
  upsertCustomDomainSchema,
  verifyCustomDomainSchema,
} from "./schema"

export const upsertCustomDomainAction = platformAdminActionClient
  .inputSchema(upsertCustomDomainSchema)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: { user: UserModel }
      parsedInput: { domain: string }
    }) => {
      await assertEnterpriseFeatures()
      const tenant = await tenantService.findByOwner(ctx.user.id)
      if (!tenant) {
        throw new Error("Tenant not found")
      }

      return await customDomainService.upsertDomain({
        tenantId: tenant.id,
        domain: parsedInput.domain,
      })
    },
  )

export const verifyCustomDomainAction = platformAdminActionClient
  .inputSchema(verifyCustomDomainSchema)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: { user: UserModel }
      parsedInput: { id: string }
    }) => {
      await assertEnterpriseFeatures()
      const tenant = await tenantService.findByOwner(ctx.user.id)
      if (!tenant) {
        throw new Error("Tenant not found")
      }

      return await customDomainService.verifyDomain({
        tenantId: tenant.id,
        id: parsedInput.id,
      })
    },
  )

export const deleteCustomDomainAction = platformAdminActionClient
  .inputSchema(deleteCustomDomainSchema)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: { user: UserModel }
      parsedInput: { id: string }
    }) => {
      await assertEnterpriseFeatures()
      const tenant = await tenantService.findByOwner(ctx.user.id)
      if (!tenant) {
        throw new Error("Tenant not found")
      }

      await customDomainService.removeDomain({
        tenantId: tenant.id,
        id: parsedInput.id,
      })
    },
  )
