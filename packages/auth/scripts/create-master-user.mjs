import { Pool } from "pg"
import { hashPassword } from "better-auth/crypto"

const SNOWFLAKE_EPOCH_MS = Date.parse("2004-02-01T00:00:00.000Z")

function generateSnowflakeId() {
  const now = BigInt(Date.now() - SNOWFLAKE_EPOCH_MS)
  const placeId = BigInt(Math.floor(Math.random() * 15) + 1)
  const seq = BigInt(Math.floor(Math.random() * 1024))
  return (now * 16384n + placeId * 1024n + seq).toString()
}

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL || "admin@chatbotx.com.br"
  const password = "Admin@1234"
  const name = "Master Admin"

  console.log(`🚀 Iniciando criação do Usuário Master: ${email}...`)

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined in environment.")
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 })
  const client = await pool.connect()

  try {
    // 0. Verifica se o Tenant '1' (Root) existe
    const tenantRes = await client.query(
      'SELECT id FROM "Tenant" WHERE id = $1',
      ["1"],
    )
    if (tenantRes.rows.length === 0) {
      await client.query(
        'INSERT INTO "Tenant" (id, name, "createdAt", "updatedAt") VALUES ($1, $2, now(), now())',
        ["1", "Plataforma Chatbot"],
      )
      console.log("✅ Root Tenant ('1') inicializado.")
    }

    // 1. Verifica ou cria o usuário
    let userId
    const userRes = await client.query(
      'SELECT id FROM "User" WHERE email = $1',
      [email],
    )
    if (userRes.rows.length === 0) {
      userId = generateSnowflakeId()
      await client.query(
        'INSERT INTO "User" ("id", "email", "name", "emailVerified", "tenantId", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $4, now(), now())',
        [userId, email, name, "1"],
      )
      console.log(`✅ Usuário criado com ID: ${userId}`)
    } else {
      userId = userRes.rows[0].id
      console.log(`ℹ️ Usuário já existente: ID ${userId}`)
    }

    // 2. Cria ou atualiza a senha de credencial
    const hashedPassword = await hashPassword(password)
    const accountRes = await client.query(
      'SELECT id FROM "Account" WHERE "userId" = $1',
      [userId],
    )

    if (accountRes.rows.length === 0) {
      const accountId = generateSnowflakeId()
      await client.query(
        'INSERT INTO "Account" ("id", "accountId", "providerId", "password", "userId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, now(), now())',
        [accountId, userId, "credential", hashedPassword, userId],
      )
      console.log(`✅ Credenciais cadastradas (Senha: ${password})`)
    } else {
      await client.query(
        'UPDATE "Account" SET "password" = $1, "updatedAt" = now() WHERE "userId" = $2',
        [hashedPassword, userId],
      )
      console.log(`✅ Senha atualizada para: ${password}`)
    }

    // 3. Promove a Super-Admin da plataforma (PlatformAdmin)
    const adminRes = await client.query(
      'SELECT id FROM "PlatformAdmin" WHERE "userId" = $1',
      [userId],
    )
    if (adminRes.rows.length === 0) {
      const adminId = generateSnowflakeId()
      await client.query(
        'INSERT INTO "PlatformAdmin" ("id", "userId", "role", "createdAt", "updatedAt") VALUES ($1, $2, $3, now(), now())',
        [adminId, userId, "super-admin"],
      )
      console.log(`👑 Promovido a Super-Admin da Plataforma!`)
    } else {
      console.log(`👑 Já possui permissão de Super-Admin da Plataforma.`)
    }

    // 4. Cria Quota Enterprise Ilimitada (Tier Master White-Label)
    await client.query(
      `INSERT INTO "UserQuota" ("userId", "planName", "planStatus", "whiteLabel", "createdAt", "updatedAt")
       VALUES ($1, 'Enterprise Ilimitado', 'active', true, now(), now())
       ON CONFLICT ("userId") DO UPDATE SET
         "planName" = 'Enterprise Ilimitado',
         "planStatus" = 'active',
         "whiteLabel" = true,
         "contactsLimit" = NULL,
         "workspacesLimit" = NULL,
         "channelsLimit" = NULL,
         "teamMembersLimit" = NULL,
         "macLimit" = NULL,
         "botMessagesLimit" = NULL,
         "monthlyBotMessagesLimit" = NULL,
         "updatedAt" = now()`,
      [userId],
    )
    console.log(`💎 Quota Enterprise White-Label Ilimitada aplicada!`)

    // 5. Cria Workspace Master (se não houver)
    let workspaceId
    const wsRes = await client.query(
      'SELECT id FROM "Workspace" WHERE "ownerId" = $1',
      [userId],
    )

    if (wsRes.rows.length === 0) {
      workspaceId = generateSnowflakeId()
      await client.query(
        'INSERT INTO "Workspace" ("id", "ownerId", "name", "timezone", "tenantId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, now(), now())',
        [
          workspaceId,
          userId,
          "Matriz Brasil (Master)",
          "America/Sao_Paulo",
          "1",
        ],
      )

      const memberId = generateSnowflakeId()
      await client.query(
        'INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "permissions", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, now(), now())',
        [
          memberId,
          workspaceId,
          userId,
          "owner",
          JSON.stringify({
            superAdmin: true,
            analytics: true,
            flows: true,
            contacts: true,
            onlyAssignedContacts: true,
            emailAndPhone: true,
            broadcast: true,
            ecommerce: true,
          }),
        ],
      )
      console.log(
        `🏢 Workspace Master criado: Matriz Brasil (Master) (ID: ${workspaceId})`,
      )
    } else {
      workspaceId = wsRes.rows[0].id
      console.log(`🏢 Workspace já existente: ID ${workspaceId}`)
    }

    console.log(`\n🎉 Usuário Master pronto para acesso:`)
    console.log(`📧 E-mail: ${email}`)
    console.log(`🔑 Senha:  ${password}`)
    console.log(`🚀 Painel: http://localhost:3123\n`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error("❌ Erro ao criar usuário master:", err)
  process.exit(1)
})
