import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';
import { Resend } from 'npm:resend@4.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseTenantToBranding } from './_templates/branding.ts';
import { renderRecoveryEmail } from './_templates/recovery.ts';
import { renderPasswordChangedEmail } from './_templates/password-changed.ts';
import { renderGenericEmail } from './_templates/generic.ts';
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

  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@resend.dev';
  const fromName = branding.companyName;

  const buildConfirmationUrl = () => {
    const redirect = redirect_to || site_url;
    return `${supabaseUrl}/auth/v1/verify?token_hash=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(email_action_type)}&redirect_to=${encodeURIComponent(redirect)}`;
  };

  let html: string;
  let subject: string;

  switch (email_action_type) {
    case 'recovery': {
      subject = `${ACTION_SUBJECTS.recovery} - ${branding.companyName}`;
      html = renderRecoveryEmail({
        branding,
        confirmationUrl: buildConfirmationUrl(),
        token,
        email: user.email,
      });
      break;
    }
    case 'password_change': {
      subject = `${ACTION_SUBJECTS.password_change} - ${branding.companyName}`;
      html = renderPasswordChangedEmail({
        branding,
        email: user.email,
      });
      break;
    }
    default: {
      subject = `${ACTION_SUBJECTS[email_action_type] ?? 'Ação necessária'} - ${branding.companyName}`;
      html = renderGenericEmail({
        branding,
        confirmationUrl: buildConfirmationUrl(),
        token,
        email: user.email,
        actionType: email_action_type,
        subject,
        heading: ACTION_SUBJECTS[email_action_type] ?? 'Ação necessária',
        body: `Clique no botão abaixo para continuar.`,
        ctaText: 'Continuar',
      });
    }
  }

  const { error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [user.email],
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
