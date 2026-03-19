import type { TenantBranding } from '../../_shared/branding.ts';

interface PdiEvidenceApprovedEmailParams {
  branding: TenantBranding;
  managerName: string;
  collaboratorName: string;
  pdiUrl: string;
  fileName: string;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderPdiEvidenceApprovedEmail(params: PdiEvidenceApprovedEmailParams): string {
  const { branding, managerName, collaboratorName, pdiUrl, fileName } = params;

  const safeManager = escapeHtml(managerName);
  const safeCollaborator = escapeHtml(collaboratorName);
  const safeFileName = escapeHtml(fileName);
  const safePdiUrl = escapeHtml(pdiUrl);

  const logoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${branding.companyName}" width="120" height="40" style="display:block;margin-bottom:24px;margin:20px auto;object-fit:contain; height: auto;border-radius:12px 12px;" />`
    : `<div style="font-size:24px;font-weight:bold;color:${branding.primaryColorHex};margin-bottom:24px;">${branding.companyName}</div>`;

  const heading = 'Sua evidência foi aprovada';
  const body = `${safeManager} aprovou sua evidência enviada para o seu PDI.`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading} - ${branding.companyName}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:40px 40px 24px;">
              ${logoHtml}
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#18181b;">Olá, ${safeCollaborator}</h1>
              <h3 style="margin:0 0 14px;font-size:16px;font-weight:600;color:#52525b;">${heading}</h3>
              <p style="margin:0 0 12px;font-size:16px;line-height:24px;color:#52525b;">${body}</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:20px;color:#52525b;">Arquivo: <strong>${safeFileName}</strong></p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center">
                    <a href="${safePdiUrl}" style="display:inline-block;padding:14px 28px;background-color:${branding.primaryColorHex};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;border-radius:8px;">Ver no portal</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">${branding.companyName} – Plataforma de RH</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

