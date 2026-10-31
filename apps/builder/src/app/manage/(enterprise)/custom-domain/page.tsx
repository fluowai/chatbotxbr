import { customDomainService, tenantService } from "@chatbotx.io/business"
import { notFound } from "next/navigation"
import { CustomDomainSettings } from "@/enterprise/features/custom-domain/custom-domain-settings"
import { getCurrentUserId } from "@/lib/auth/utils"
import { getBrokerOrigin } from "@/lib/oauth-broker"

export default async function ManageCustomDomainPage() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return notFound()
  }

  const tenant = await tenantService.findByOwner(userId)
  if (!tenant) {
    return notFound()
  }

  const domain = await customDomainService.findActiveByTenantId(tenant.id)
  const allDomains = await customDomainService.findByTenantId(tenant.id)
  const currentDomain = domain ?? allDomains[0]

  let brokerHost: string | undefined
  try {
    const origin = getBrokerOrigin()
    brokerHost = new URL(origin).hostname
  } catch {
    brokerHost = undefined
  }

  return (
    <div className="space-y-4">
      <CustomDomainSettings domain={currentDomain} brokerHost={brokerHost} />
    </div>
  )
}
