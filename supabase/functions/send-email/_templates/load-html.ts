
/**
 * Loads a template by base name (e.g. "recovery" -> recovery.html).
 * Returns fallback HTML if the file cannot be read so auth flow does not break.
 */
export async function loadTemplate(name: string): Promise<string> {
  switch (name) {
    case 'invite':
      return inviteTemplate();
    case 'recovery':
      return recoveryTemplate();
    case 'password_changed_notification':
      return passwordChangedNotificationTemplate();
    default:
      return getFallbackHtml(name);
  }
}

/**
 * Replaces all {{key}} placeholders in html with values from vars.
 * Unknown keys are replaced with empty string.
 */
export function replacePlaceholders(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

/**
 * Minimal fallback HTML when a template file is missing.
 */
function getFallbackHtml(name: string): string {
  const title = name === 'recovery' ? 'Redefinir senha' : name === 'password_changed_notification' ? 'Senha alterada' : name === 'invite' ? 'Convite' : 'Ação necessária';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:sans-serif;padding:24px;">
  <h1>${title}</h1>
  <p>Use o link abaixo para continuar:</p>
  <p><a href="{{action_url}}" style="color:#2d7a4a;">Continuar</a></p>
  <p style="color:#71717a;font-size:12px;">{{company_name}} – Plataforma de RH</p>
</body>
</html>`;
}

function inviteTemplate(): string {
  return `
  <!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Você foi convidado - {{company_name}}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:40px 40px 24px;">
              {{logo_html}}
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#18181b;">
                Você foi convidado
              </h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#52525b;">
                Olá, você foi convidado a fazer parte da plataforma <strong>{{company_name}}</strong>. Use o botão abaixo para aceitar o convite e definir sua senha.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td>
                    <a href="{{action_url}}" style="display:inline-block;padding:14px 28px;background-color:{{primary_color}};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;border-radius:8px;">
                      Aceitar convite
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Se você não esperava este convite, pode ignorar este e-mail.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                {{company_name}} – Plataforma de RH
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>

  `
}

function recoveryTemplate(): string {
  return `
  <!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir senha - {{company_name}}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:40px 40px 24px;">
              {{logo_html}}
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#18181b;">
                Redefinir sua senha
              </h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#52525b;">
                Olá, recebemos uma solicitação para redefinir a senha da sua conta <strong>{{email}}</strong> na {{company_name}}.
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#52525b;">
                Clique no botão abaixo para definir uma nova senha:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td>
                    <a href="{{action_url}}" style="display:inline-block;padding:14px 28px;background-color:{{primary_color}};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;border-radius:8px;">
                      Redefinir senha
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:14px;color:#71717a;">
                Ou copie e cole este código na página de redefinição:
              </p>
              <p style="margin:0 0 24px;padding:16px;background:#f4f4f5;border-radius:8px;font-family:monospace;font-size:18px;letter-spacing:4px;color:#18181b;">
                {{token}}
              </p>
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Se você não solicitou a redefinição de senha, ignore este e-mail. O link expira em 24 horas.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                {{company_name}} – Plataforma de RH
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>

  `
}

function passwordChangedNotificationTemplate(): string {
  return `
  <!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Senha alterada - {{company_name}}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:40px 40px 24px;">
              {{logo_html}}
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#18181b;">
                Senha alterada com sucesso
              </h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#52525b;">
                Confirmamos que a senha da sua conta <strong>{{email}}</strong> na {{company_name}} foi alterada com sucesso.
              </p>
              <p style="margin:0;font-size:14px;color:#71717a;">
                Se você não fez essa alteração, entre em contato com o suporte imediatamente.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                {{company_name}} – Plataforma de RH
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>

  
  `
}