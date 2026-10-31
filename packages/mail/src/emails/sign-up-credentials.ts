import { type BaseEmailProps, buildSystemEmail, esc } from "./base-template"

export const DEFAULT_ACCOUNT_CREDENTIALS_SUBJECT =
  "Sua conta em {{brandName}} está pronta"

export type AccountCredentialsProps = BaseEmailProps & {
  userName: string
  loginEmail: string
  initialPassword: string
  signInUrl: string
}

export function buildAccountCredentialsMjml(
  props: AccountCredentialsProps,
): string {
  const { userName, loginEmail, initialPassword, signInUrl } = props
  const body = `<mj-section padding="0 0 16px 0">
      <mj-column>
        <mj-text padding="0 0 8px 0">Olá ${esc(userName)},</mj-text>
        <mj-text padding="0">
          Sua conta está pronta. Utilize as credenciais abaixo para entrar.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="0 0 16px 0">
      <mj-column>
        <mj-text padding="0 0 4px 0" font-size="13px" color="#6b7280">E-mail</mj-text>
        <mj-text padding="0 0 12px 0" font-size="16px" font-weight="700">${esc(loginEmail)}</mj-text>
        <mj-text padding="0 0 4px 0" font-size="13px" color="#6b7280">Senha temporária</mj-text>
        <mj-text padding="0 0 12px 0" font-size="16px" font-weight="700">${esc(initialPassword)}</mj-text>
        <mj-button href="${esc(signInUrl)}" align="left">Entrar na plataforma</mj-button>
      </mj-column>
    </mj-section>
    <mj-section padding="0 0 16px 0">
      <mj-column>
        <mj-text padding="0" font-size="14px" color="#888888">
          Você será solicitado a alterar esta senha no seu primeiro acesso.
        </mj-text>
      </mj-column>
    </mj-section>`

  return buildSystemEmail(props, body)
}
