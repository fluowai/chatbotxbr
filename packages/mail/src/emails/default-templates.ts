import { buildSystemEmail } from "./base-template"
import {
  buildAccountCredentialsMjml,
  DEFAULT_ACCOUNT_CREDENTIALS_SUBJECT,
} from "./sign-up-credentials"

function buildDefaultMjml(subject: string, bodyMjml: string): string {
  return buildSystemEmail(
    {
      brandName: "{{brandName}}",
      brandLogoUrl: "{{brandLogoUrl}}",
      brandUrl: "{{brandUrl}}",
      subject,
    },
    bodyMjml,
  )
}

export const DEFAULT_SIGNUP_SUBJECT = "Verifique seu endereço de e-mail"

export const SIGNUP_BODY_MJML = `<mj-section padding="0 0 16px 0">
      <mj-column>
        <mj-text padding="0 0 8px 0">Olá {{userName}},</mj-text>
        <mj-text padding="0">
          Obrigado por se cadastrar! Por favor, confirme seu endereço de e-mail clicando no botão abaixo.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="0 0 16px 0">
      <mj-column>
        <mj-button href="{{verificationUrl}}" align="left">Confirmar E-mail</mj-button>
        <mj-text padding="8px 0 0 0" font-size="13px" color="#888888">
          Ou utilize este link: <a href="{{verificationUrl}}" style="color:#3b82f6">{{verificationUrl}}</a>
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="0 0 16px 0">
      <mj-column>
        <mj-text padding="0" font-size="14px" color="#888888">
          Este link expira em 24 horas. Se você não criou esta conta, pode ignorar este e-mail com segurança.
        </mj-text>
      </mj-column>
    </mj-section>`

export const DEFAULT_SIGNUP_TEMPLATE = buildDefaultMjml(
  DEFAULT_SIGNUP_SUBJECT,
  SIGNUP_BODY_MJML,
)

export const DEFAULT_FORGOT_PASSWORD_SUBJECT = "Redefina sua senha"

export const FORGOT_PASSWORD_BODY_MJML = `<mj-section padding="0 0 16px 0">
      <mj-column>
        <mj-text padding="0 0 8px 0">Olá {{userName}},</mj-text>
        <mj-text padding="0">
          Recebemos uma solicitação para redefinir a senha da sua conta.
          Clique no botão abaixo para definir uma nova senha.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="0 0 16px 0">
      <mj-column>
        <mj-button href="{{resetPasswordUrl}}" align="left">Redefinir Senha</mj-button>
        <mj-text padding="8px 0 0 0" font-size="13px" color="#888888">
          Ou utilize este link: <a href="{{resetPasswordUrl}}" style="color:#3b82f6">{{resetPasswordUrl}}</a>
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="0 0 16px 0">
      <mj-column>
        <mj-text padding="0" font-size="14px" color="#888888">
          Este link expira em 1 hora. Se você não solicitou a redefinição de senha,
          pode ignorar este e-mail com segurança — sua senha permanecerá a mesma.
        </mj-text>
      </mj-column>
    </mj-section>`

export const DEFAULT_FORGOT_PASSWORD_TEMPLATE = buildDefaultMjml(
  DEFAULT_FORGOT_PASSWORD_SUBJECT,
  FORGOT_PASSWORD_BODY_MJML,
)

export const DEFAULT_MAGIC_LINK_SUBJECT = "Entrar em {{brandName}}"

export const MAGIC_LINK_BODY_MJML = `<mj-section padding="0 0 16px 0">
      <mj-column>
        <mj-text padding="0 0 8px 0">Olá {{userName}},</mj-text>
        <mj-text padding="0">
          Clique no botão abaixo para acessar sua conta em {{brandName}} com segurança.
          Este link expira em 15 minutos e só pode ser utilizado uma vez.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="0 0 16px 0">
      <mj-column>
        <mj-button href="{{magicUrl}}" align="left">Entrar em {{brandName}}</mj-button>
        <mj-text padding="8px 0 0 0" font-size="13px" color="#888888">
          Ou utilize este link: <a href="{{magicUrl}}" style="color:#3b82f6">{{magicUrl}}</a>
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="0 0 16px 0">
      <mj-column>
        <mj-text padding="0" font-size="14px" color="#888888">
          Se você não solicitou este acesso, pode ignorar este e-mail com segurança.
        </mj-text>
      </mj-column>
    </mj-section>`

export const DEFAULT_MAGIC_LINK_TEMPLATE = buildDefaultMjml(
  DEFAULT_MAGIC_LINK_SUBJECT,
  MAGIC_LINK_BODY_MJML,
)

export const DEFAULT_ACCOUNT_CREDENTIALS_TEMPLATE = buildAccountCredentialsMjml(
  {
    brandName: "{{brandName}}",
    brandLogoUrl: "{{brandLogoUrl}}",
    brandUrl: "{{brandUrl}}",
    subject: DEFAULT_ACCOUNT_CREDENTIALS_SUBJECT,
    userName: "{{userName}}",
    loginEmail: "{{loginEmail}}",
    initialPassword: "{{initialPassword}}",
    signInUrl: "{{signInUrl}}",
  },
)
