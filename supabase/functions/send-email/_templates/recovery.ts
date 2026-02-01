import type { TenantBranding } from './branding.ts';

interface RecoveryParams {
  branding: TenantBranding;
  confirmationUrl: string;
  token: string;
  email: string;
}

export function renderRecoveryEmail(params: RecoveryParams): string {
  const { branding, confirmationUrl, token, email } = params;
  const logoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${branding.companyName}" width="120" height="40" style="display:block;margin-bottom:24px;" />`
    : `<div style="font-size:24px;font-weight:bold;color:${branding.primaryColorHex};margin-bottom:24px;">${branding.companyName}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir senha - ${branding.companyName}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:40px 40px 24px;">
              ${logoHtml}
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#18181b;">
                Redefinir sua senha
              </h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#52525b;">
                Olá, recebemos uma solicitação para redefinir a senha da sua conta <strong>${email}</strong> na ${branding.companyName}.
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#52525b;">
                Clique no botão abaixo para definir uma nova senha:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td>
                    <a href="${confirmationUrl}" style="display:inline-block;padding:14px 28px;background-color:${branding.primaryColorHex};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;border-radius:8px;">
                      Redefinir senha
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:14px;color:#71717a;">
                Ou copie e cole este código na página de redefinição:
              </p>
              <p style="margin:0 0 24px;padding:16px;background:#f4f4f5;border-radius:8px;font-family:monospace;font-size:18px;letter-spacing:4px;color:#18181b;">
                ${token}
              </p>
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Se você não solicitou a redefinição de senha, ignore este e-mail. O link expira em 24 horas.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                ${branding.companyName} – Plataforma de RH
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
