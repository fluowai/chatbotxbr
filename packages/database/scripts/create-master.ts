import { scryptSync, randomBytes } from "node:crypto"
import { createId } from "@chatbotx.io/utils"
import { db, eq } from "../src/client"
import {
  accountModel,
  userModel,
  workspaceMemberModel,
  workspaceModel,
  userQuotaModel,
  platformAdminModel,
} from "../src/schema"

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const derivedKey = scryptSync(password, salt, 64)
  return `${salt}:${derivedKey.toString("hex")}`
}

async function createMasterUser(
  email = process.env.PLATFORM_ADMIN_EMAIL || "admin@chatbotx.com.br",
  password = "Admin@1234",
  name = "Master Admin",
) {
  console.log(`🚀 Iniciando criação do Usuário Master: ${email}...`)

  // 1. Verifica ou cria o usuário
  let user = await db.query.userModel.findFirst({
    where: eq(userModel.email, email),
  })

  if (!user) {
    const [created] = await db
      .insert(userModel)
      .values({
        email,
        name,
        emailVerified: true,
      })
      .returning()
    user = created
    console.log(`✅ Usuário criado com ID: ${user.id}`)
  } else {
    console.log(`ℹ️ Usuário já existente: ID ${user.id}`)
  }

  // 2. Cria ou atualiza a senha de credencial
  const existingAccount = await db.query.accountModel.findFirst({
    where: eq(accountModel.userId, user.id),
  })

  const hashedPassword = hashPassword(password)

  if (!existingAccount) {
    await db.insert(accountModel).values({
      id: createId(),
      accountId: user.id,
      providerId: "credential",
      password: hashedPassword,
      userId: user.id,
    })
    console.log(`✅ Credenciais cadastradas (Senha padrão: ${password})`)
  } else {
    await db
      .update(accountModel)
      .set({ password: hashedPassword })
      .where(eq(accountModel.userId, user.id))
    console.log(`✅ Senha atualizada para: ${password}`)
  }

  // 3. Promove a Super-Admin da plataforma (PlatformAdmin)
  const existingAdmin = await db.query.platformAdminModel.findFirst({
    where: eq(platformAdminModel.userId, user.id),
  })

  if (!existingAdmin) {
    await db.insert(platformAdminModel).values({
      id: createId(),
      userId: user.id,
      role: "super-admin",
    })
    console.log(`👑 Promovido a Super-Admin da Plataforma!`)
  }

  // 4. Cria Quota Enterprise Ilimitada (Tier Master White-Label)
  await db
    .insert(userQuotaModel)
    .values({
      userId: user.id,
      planName: "Enterprise Ilimitado",
      planStatus: "active",
      whiteLabel: true,
      contactsLimit: null,
      workspacesLimit: null,
      channelsLimit: null,
      teamMembersLimit: null,
      macLimit: null,
      botMessagesLimit: null,
      monthlyBotMessagesLimit: null,
    })
    .onConflictDoUpdate({
      target: userQuotaModel.userId,
      set: {
        planName: "Enterprise Ilimitado",
        planStatus: "active",
        whiteLabel: true,
        contactsLimit: null,
        workspacesLimit: null,
        channelsLimit: null,
        teamMembersLimit: null,
        macLimit: null,
        botMessagesLimit: null,
        monthlyBotMessagesLimit: null,
      },
    })
  console.log(`💎 Quota Enterprise White-Label Ilimitada aplicada!`)

  // 5. Cria Workspace Master (se não houver)
  let workspace = await db.query.workspaceModel.findFirst({
    where: eq(workspaceModel.ownerId, user.id),
  })

  if (!workspace) {
    const [ws] = await db
      .insert(workspaceModel)
      .values({
        id: createId(),
        ownerId: user.id,
        name: "Matriz Brasil (Master)",
        timezone: "America/Sao_Paulo",
      })
      .returning()
    workspace = ws

    await db.insert(workspaceMemberModel).values({
      id: createId(),
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
      permissions: {
        superAdmin: true,
        analytics: true,
        flows: true,
        contacts: true,
        onlyAssignedContacts: true,
        emailAndPhone: true,
        broadcast: true,
        ecommerce: true,
      },
    })
    console.log(
      `🏢 Workspace Master criado: ${workspace.name} (ID: ${workspace.id})`,
    )
  }

  console.log(`\n🎉 Usuário Master pronto para acesso:`)
  console.log(`📧 E-mail: ${email}`)
  console.log(`🔑 Senha:  ${password}`)
  console.log(`🚀 Painel: http://localhost:3123\n`)
}

createMasterUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Erro ao criar usuário master:", err)
    process.exit(1)
  })
