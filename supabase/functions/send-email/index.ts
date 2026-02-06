import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { Resend } from 'npm:resend@4.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import type { TenantBranding } from './_templates/branding.ts';
import { parseTenantToBranding } from './_templates/branding.ts';
import { loadTemplate, replacePlaceholders } from './_templates/load-html.ts';
import { corsHeaders } from '../_shared/cors.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') ?? '');
const hookSecretRaw = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '';
const hookSecret = hookSecretRaw.replace(/^v1,whsec_/, '');
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

interface HookPayload {
  user: { id: string; email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
    user_email?: string;
  };
}

const ACTION_SUBJECTS: Record<string, string> = {
  recovery: 'Redefinir senha',
  magiclink: 'Link de acesso',
  signup: 'Confirmar cadastro',
  invite: 'Você foi convidado',
  email_change: 'Confirmar alteração de e-mail',
  reauthentication: 'Confirmar reautenticação',
  password_change: 'Senha alterada',
};

const TEMPLATE_MAP: Record<string, string> = {
  recovery: 'recovery',
  password_change: 'password_changed_notification',
  invite: 'invite',
};

const DEFAULT_PRIMARY = '#2d7a4a';
const DEFAULT_COMPANY = 'Eleva';

function buildLogoHtml(branding: TenantBranding): string {
  const name = branding.companyName || DEFAULT_COMPANY;
  const color = branding.primaryColorHex || DEFAULT_PRIMARY;
  if (branding.logoUrl) {
    return `<img src="${branding.logoUrl}" alt="${name}" width="120" height="40" style="display:block;margin-bottom:24px;" />`;
  }
  return `<div style="font-size:24px;font-weight:bold;color:${color};margin-bottom:24px;">${name}</div>`;
}

function buildBaseVars(branding: TenantBranding): Record<string, string> {
  return {
    company_name: branding.companyName || DEFAULT_COMPANY,
    primary_color: branding.primaryColorHex || DEFAULT_PRIMARY,
    logo_html: buildLogoHtml(branding),
    app_url: branding.appUrl || '',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  const wh = new Webhook(hookSecret);
  let data: HookPayload;
  try {
    data = wh.verify(payload, headers) as HookPayload;
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return new Response(
      JSON.stringify({ error: 'Invalid signature' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { user, email_data } = data;
  const { token, token_hash, redirect_to, email_action_type, site_url } = email_data;

  if (!user?.email) {
    return new Response(
      JSON.stringify({ error: 'Missing user email' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let tenant: { company_name: string; logo_url?: string | null; primary_color?: string | null; accent_color?: string | null; app_url?: string | null } | null = null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.tenant_id) {
    const { data: t } = await supabaseAdmin
      .from('tenants')
      .select('company_name, logo_url, primary_color, accent_color, app_url')
      .eq('id', profile.tenant_id)
      .maybeSingle();
    tenant = t;
  }

  const branding = parseTenantToBranding(tenant, site_url);
  const baseVars = buildBaseVars(branding);
  const userEmail = user.email;

  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@resend.dev';
  const fromName = branding.companyName;

  const buildConfirmationUrl = () => {
    return `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(email_action_type)}&redirect_to=${encodeURIComponent(redirect_to)}`;
  };

  const actionUrl = buildConfirmationUrl();
  const templateName = TEMPLATE_MAP[email_action_type] ?? 'generic';

  let html: string;
  let subject: string;

  const rawHtml = await loadTemplate(templateName);

  switch (email_action_type) {
    case 'recovery': {
      subject = `${ACTION_SUBJECTS.recovery} - ${branding.companyName}`;
      html = replacePlaceholders(rawHtml, {
        ...baseVars,
        action_url: actionUrl,
        email: userEmail,
        token: token || '',
      });
      break;
    }
    case 'password_change': {
      subject = `${ACTION_SUBJECTS.password_change} - ${branding.companyName}`;
      html = replacePlaceholders(rawHtml, {
        ...baseVars,
        email: userEmail,
      });
      break;
    }
    case 'invite': {
      subject = `${ACTION_SUBJECTS.invite} - ${branding.companyName}`;
      html = replacePlaceholders(rawHtml, {
        ...baseVars,
        action_url: actionUrl,
      });
      break;
    }
    default: {
      subject = `${ACTION_SUBJECTS[email_action_type] ?? 'Ação necessária'} - ${branding.companyName}`;
      const heading = ACTION_SUBJECTS[email_action_type] ?? 'Ação necessária';
      const tokenBlock = token
        ? `<p style="margin:0 0 24px;padding:16px;background:#f4f4f5;border-radius:8px;font-family:monospace;font-size:18px;letter-spacing:4px;color:#18181b;">${token}</p>`
        : '';
      html = replacePlaceholders(rawHtml, {
        ...baseVars,
        action_url: actionUrl,
        heading,
        body: 'Clique no botão abaixo para continuar.',
        cta_text: 'Continuar',
        token_block: tokenBlock,
      });
    }
  }

  const { error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [userEmail],
    subject,
    html,
  });

  if (error) {
    console.error('Resend error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
