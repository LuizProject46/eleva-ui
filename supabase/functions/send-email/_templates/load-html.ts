/**
 * Load HTML template files and replace {{placeholder}} with runtime variables.
 * Templates live in ../templates/ relative to this module (send-email/templates/).
 * Runs in Deno (Supabase Edge Functions).
 */
const TEMPLATE_DIR = new URL('../templates/', import.meta.url);

/**
 * Loads a template by base name (e.g. "recovery" -> recovery.html).
 * Returns fallback HTML if the file cannot be read so auth flow does not break.
 */
export async function loadTemplate(name: string): Promise<string> {
  const path = new URL(`${name}.html`, TEMPLATE_DIR);
  try {
    return await Deno.readTextFile(path);
  } catch (err) {
    console.error(`Failed to load template ${name}.html:`, err);
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
