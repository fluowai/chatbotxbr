import { db, eq } from "@chatbotx.io/database/client"
import { customDomainModel } from "@chatbotx.io/database/schema"
import { invalidateCacheByTags, withCache } from "@chatbotx.io/redis"
import { ChatbotXException } from "../../errors"

export const customDomainService = {
  findActiveByDomain(domain: string) {
    return withCache(
      `custom-domain:active:${domain}`,
      () =>
        db.query.customDomainModel.findFirst({
          where: { domain, status: "active" },
        }),
      { tags: [`cd:domain:${domain}`] },
    )
  },

  /**
   * Every active custom domain (hostnames only). Used by the auth layer's
   * `trustedOrigins`, which better-auth evaluates on *every* request — so this is
   * cached with a short TTL rather than scanning `CustomDomain` each time. The
   * 60s TTL is a self-healing safety net: a newly verified domain becomes a
   * trusted origin within a minute even if the (private) write path doesn't
   * invalidate the `cd:active:all` tag.
   */
  async listActiveDomains(): Promise<string[]> {
    const rows = await withCache(
      "custom-domain:active:all",
      () =>
        db.query.customDomainModel.findMany({
          where: { status: "active" },
          columns: { domain: true },
        }),
      { tags: ["cd:active:all"], ttl: 60 },
    )
    return rows.map((row) => row.domain)
  },

  findByTenantId(tenantId: string) {
    return withCache(
      `custom-domain:tenant:${tenantId}`,
      () =>
        db.query.customDomainModel.findMany({
          where: { tenantId },
        }),
      {
        tags: [`cd:tenant:${tenantId}`],
        dynamicTags: (results) => results.map((r) => `cd:domain:${r.domain}`),
      },
    )
  },

  /**
   * The tenant's active custom domain, if any. `CustomDomain.tenantId` is
   * unique, so there is at most one — no "first active" picking needed.
   */
  findActiveByTenantId(tenantId: string) {
    return withCache(
      `custom-domain:active-tenant:${tenantId}`,
      () =>
        db.query.customDomainModel.findFirst({
          where: { tenantId, status: "active" },
        }),
      {
        tags: [`cd:tenant:${tenantId}`],
        dynamicTags: (result) => (result ? [`cd:domain:${result.domain}`] : []),
      },
    )
  },

  /**
   * Provision or update a custom domain for a tenant.
   * Normalizes the domain and prevents cross-tenant domain collisions.
   */
  async upsertDomain({
    tenantId,
    domain,
  }: {
    tenantId: string
    domain: string
  }) {
    const cleanDomain = domain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")

    if (
      !cleanDomain ||
      cleanDomain.includes(" ") ||
      !cleanDomain.includes(".")
    ) {
      throw new ChatbotXException(
        "Invalid domain format",
        "invalidDomainFormat",
        400,
      )
    }

    const existing = await db.query.customDomainModel.findFirst({
      where: { domain: cleanDomain },
    })

    if (existing && existing.tenantId !== tenantId) {
      throw new ChatbotXException(
        "Domain already claimed by another tenant",
        "domainAlreadyInUse",
        409,
      )
    }

    const currentForTenant = await db.query.customDomainModel.findFirst({
      where: { tenantId },
    })

    let row
    if (currentForTenant) {
      const [updated] = await db
        .update(customDomainModel)
        .set({
          domain: cleanDomain,
          status: "pending",
          verifiedAt: null,
        })
        .where(eq(customDomainModel.id, currentForTenant.id))
        .returning()
      row = updated
      await invalidateCacheByTags([`cd:domain:${currentForTenant.domain}`])
    } else {
      const [created] = await db
        .insert(customDomainModel)
        .values({
          tenantId,
          domain: cleanDomain,
          status: "pending",
        })
        .returning()
      row = created
    }

    await invalidateCacheByTags([
      `cd:tenant:${tenantId}`,
      `cd:domain:${cleanDomain}`,
      "cd:active:all",
      `custom-domain:active-tenant:${tenantId}`,
    ])

    return row
  },

  /**
   * Mark a domain as active (verified).
   */
  async verifyDomain({
    tenantId,
    id,
  }: {
    tenantId: string
    id: string
  }) {
    const row = await db.query.customDomainModel.findFirst({
      where: { id, tenantId },
    })
    if (!row) {
      throw new ChatbotXException("Domain not found", "domainNotFound", 404)
    }

    const [updated] = await db
      .update(customDomainModel)
      .set({
        status: "active",
        verifiedAt: new Date(),
      })
      .where(eq(customDomainModel.id, id))
      .returning()

    await invalidateCacheByTags([
      `cd:tenant:${tenantId}`,
      `cd:domain:${row.domain}`,
      "cd:active:all",
      `custom-domain:active-tenant:${tenantId}`,
    ])

    return updated
  },

  /**
   * Remove a custom domain for a tenant.
   */
  async removeDomain({
    tenantId,
    id,
  }: {
    tenantId: string
    id: string
  }) {
    const row = await db.query.customDomainModel.findFirst({
      where: { id, tenantId },
    })
    if (!row) {
      return
    }

    await db.delete(customDomainModel).where(eq(customDomainModel.id, id))

    await invalidateCacheByTags([
      `cd:tenant:${tenantId}`,
      `cd:domain:${row.domain}`,
      "cd:active:all",
      `custom-domain:active-tenant:${tenantId}`,
    ])
  },
}
