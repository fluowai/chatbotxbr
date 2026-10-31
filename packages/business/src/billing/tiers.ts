import { db, eq } from "@chatbotx.io/database/client"
import { planStatuses } from "@chatbotx.io/database/partials"
import { userQuotaModel } from "@chatbotx.io/database/schema"
import { userQuotaService } from "../user-quota/service"

export interface BrazilianTier {
  id: "starter" | "pro" | "scale" | "agency" | "enterprise"
  name: string
  description: string
  priceBrl: number
  workspacesLimit: number | null
  channelsLimit: number | null
  teamMembersLimit: number | null
  contactsLimit: number | null
  macLimit: number | null
  botMessagesLimit: number | null
  monthlyBotMessagesLimit: number | null
  whiteLabel: boolean
  customDomain: boolean
}

export const BRAZILIAN_TIERS: Record<BrazilianTier["id"], BrazilianTier> = {
  starter: {
    id: "starter",
    name: "Starter (Iniciante)",
    description: "Ideal para validação, autônomos e pequenos negócios",
    priceBrl: 97,
    workspacesLimit: 1,
    channelsLimit: 2,
    teamMembersLimit: 1,
    contactsLimit: 1500,
    macLimit: 1500,
    botMessagesLimit: 10000,
    monthlyBotMessagesLimit: 10000,
    whiteLabel: false,
    customDomain: false,
  },
  pro: {
    id: "pro",
    name: "Pro (Infoprodutor & PME)",
    description:
      "Perfeito para infoprodutores, criadores de conteúdo e recuperação de vendas",
    priceBrl: 197,
    workspacesLimit: 3,
    channelsLimit: 5,
    teamMembersLimit: 3,
    contactsLimit: 10000,
    macLimit: 10000,
    botMessagesLimit: 50000,
    monthlyBotMessagesLimit: 50000,
    whiteLabel: false,
    customDomain: false,
  },
  scale: {
    id: "scale",
    name: "Scale (Lançamentos & E-commerce)",
    description:
      "Para grandes lançamentos, lojas virtuais e operações com alto tráfego",
    priceBrl: 397,
    workspacesLimit: 10,
    channelsLimit: 15,
    teamMembersLimit: 10,
    contactsLimit: 50000,
    macLimit: 50000,
    botMessagesLimit: 250000,
    monthlyBotMessagesLimit: 250000,
    whiteLabel: false,
    customDomain: false,
  },
  agency: {
    id: "agency",
    name: "Agência White-Label",
    description:
      "Revenda com sua própria marca, domínio personalizado e subcontas isoladas",
    priceBrl: 697,
    workspacesLimit: 50,
    channelsLimit: 100,
    teamMembersLimit: 50,
    contactsLimit: 200000,
    macLimit: 200000,
    botMessagesLimit: 1000000,
    monthlyBotMessagesLimit: 1000000,
    whiteLabel: true,
    customDomain: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise Ilimitado",
    description: "Sem limites de contatos, canais ou mensagens. Estrutura dedicada",
    priceBrl: 1497,
    workspacesLimit: null,
    channelsLimit: null,
    teamMembersLimit: null,
    contactsLimit: null,
    macLimit: null,
    botMessagesLimit: null,
    monthlyBotMessagesLimit: null,
    whiteLabel: true,
    customDomain: true,
  },
}

export const getTierById = (tierId: string): BrazilianTier | undefined => {
  return BRAZILIAN_TIERS[tierId as BrazilianTier["id"]]
}

export const applyTierToUser = async (
  userId: string,
  tierId: BrazilianTier["id"] | string,
  options?: {
    status?: (typeof planStatuses.enumValues)[number]
    trialEndsAt?: Date | null
  },
): Promise<void> => {
  const tier = getTierById(tierId) ?? BRAZILIAN_TIERS.starter
  const status = options?.status ?? planStatuses.enum.active
  const trialEndsAt = options?.trialEndsAt ?? null

  await db
    .insert(userQuotaModel)
    .values({
      userId,
      planName: tier.name,
      planStatus: status,
      trialEndsAt,
      contactsLimit: tier.contactsLimit,
      workspacesLimit: tier.workspacesLimit,
      channelsLimit: tier.channelsLimit,
      teamMembersLimit: tier.teamMembersLimit,
      macLimit: tier.macLimit,
      botMessagesLimit: tier.botMessagesLimit,
      monthlyBotMessagesLimit: tier.monthlyBotMessagesLimit,
      whiteLabel: tier.whiteLabel,
    })
    .onConflictDoUpdate({
      target: userQuotaModel.userId,
      set: {
        planName: tier.name,
        planStatus: status,
        trialEndsAt,
        contactsLimit: tier.contactsLimit,
        workspacesLimit: tier.workspacesLimit,
        channelsLimit: tier.channelsLimit,
        teamMembersLimit: tier.teamMembersLimit,
        macLimit: tier.macLimit,
        botMessagesLimit: tier.botMessagesLimit,
        monthlyBotMessagesLimit: tier.monthlyBotMessagesLimit,
        whiteLabel: tier.whiteLabel,
        updatedAt: new Date(),
      },
    })

  await userQuotaService.invalidate(userId)
}
