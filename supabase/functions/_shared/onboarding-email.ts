/**
 * Reusable onboarding email for new tenant administrators.
 * Used by provision-tenant and can be reused for "resend onboarding" flows.
 */

export interface OnboardingEmailParams {
  companyName: string;
  adminEmail: string;
  adminPassword?: string;
  loginUrl: string;
  adminName?: string;
}

const DEFAULT_PRIMARY_HEX = '#2d7a4a';

export function renderOnboardingEmail(params: OnboardingEmailParams): string {
  const { companyName, adminEmail, adminPassword, loginUrl, adminName } = params;
  const greeting = adminName?.trim()
    ? `Olá, ${adminName.trim()}!`
    : 'Olá!';

  const passwordSection =
    adminPassword && adminPassword.length > 0
      ? `
              <p style="margin:0 0 8px;font-size:16px;line-height:24px;color:#52525b;">
                <strong>Senha de acesso:</strong> <code style="background:#f4f4f5;padding:4px 8px;border-radius:4px;font-size:14px;">${escapeHtml(adminPassword)}</code>
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:20px;color:#71717a;">Recomendamos alterar a senha após o primeiro acesso em Configurações.</p>`
      : `
              <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#52525b;">Use a senha definida no cadastro para acessar.</p>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acesso à plataforma - ${escapeHtml(companyName)}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:40px 40px 24px;">
              <div style="font-size:24px;font-weight:bold;color:${DEFAULT_PRIMARY_HEX};margin-bottom:24px;">${escapeHtml(companyName)}</div>
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#18181b;">Acesso à plataforma</h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#52525b;">${greeting}</p>
              <p style="margin:0 0 8px;font-size:16px;line-height:24px;color:#52525b;">
                Sua empresa foi cadastrada na plataforma. Utilize os dados abaixo para entrar no ambiente da <strong>${escapeHtml(companyName)}</strong>.
              </p>
              <p style="margin:0 0 8px;font-size:16px;line-height:24px;color:#52525b;">
                <strong>E-mail:</strong> ${escapeHtml(adminEmail)}
              </p>
              ${passwordSection}
              <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#52525b;">
                Acesse pelo link abaixo para garantir que você entrará no ambiente correto da sua empresa:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:14px 28px;background-color:${DEFAULT_PRIMARY_HEX};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;border-radius:8px;">Acessar plataforma</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;line-height:20px;color:#71717a;">
                Link de acesso: <a href="${escapeHtml(loginUrl)}" style="color:${DEFAULT_PRIMARY_HEX};word-break:break-all;">${escapeHtml(loginUrl)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">${escapeHtml(companyName)} – Plataforma de RH</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (ch) => map[ch] ?? ch);
}

/** Minimal type for Resend-like client so _shared does not depend on npm:resend */
interface ResendLike {
  emails: {
    send: (opts: {
      from: string;
      to: string[];
      subject: string;
      html: string;
    }) => Promise<{ error?: { message?: string } | null }>;
  };
}

export async function sendOnboardingEmail(
  resend: ResendLike,
  to: string,
  params: OnboardingEmailParams,
  fromEmail: string,
  fromName?: string
): Promise<{ error?: Error }> {
  const html = renderOnboardingEmail(params);
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: `Acesso à plataforma - ${params.companyName}`,
    html,
  });
  if (error) {
    return { error: new Error(error.message ?? 'Failed to send email') };
  }
  return {};
}
