import { Resend } from 'npm:resend@4.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { parseTenantToBranding } from '../_shared/branding.ts';
import { renderEvaluationReceivedEmail } from './_templates/evaluation-received.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') ?? '');
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

interface InvokeBody {
  evaluatedUserId: string;
  evaluatorName: string;
  type: 'evaluation' | 'feedback';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autorização necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token não encontrado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as InvokeBody;
    const { evaluatedUserId, evaluatorName, type } = body;

    if (!evaluatedUserId || !evaluatorName || !type) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: evaluatedUserId, evaluatorName, type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type !== 'evaluation' && type !== 'feedback') {
      return new Response(
        JSON.stringify({ error: 'type deve ser evaluation ou feedback' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: evaluatedProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, tenant_id')
      .eq('id', evaluatedUserId)
      .maybeSingle();

    if (profileError || !evaluatedProfile?.email) {
      return new Response(
        JSON.stringify({ error: 'Usuário avaliado não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let tenant: {
      company_name: string;
      logo_url?: string | null;
      primary_color?: string | null;
      accent_color?: string | null;
      app_url?: string | null;
    } | null = null;

    if (evaluatedProfile.tenant_id) {
      const { data: t } = await supabaseAdmin
        .from('tenants')
        .select('company_name, logo_url, primary_color, accent_color, app_url')
        .eq('id', evaluatedProfile.tenant_id)
        .maybeSingle();
      tenant = t;
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? supabaseUrl.replace('.supabase.co', '');
    const branding = parseTenantToBranding(tenant, siteUrl);

    const isFeedback = type === 'feedback';
    const subject = isFeedback
      ? `Você recebeu um feedback - ${branding.companyName}`
      : `Você recebeu uma avaliação - ${branding.companyName}`;

    const html = renderEvaluationReceivedEmail({
      branding,
      evaluatorName,
      isFeedback,
    });

    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@resend.dev';

    const { error: sendError } = await resend.emails.send({
      from: `${branding.companyName} <${fromEmail}>`,
      to: [evaluatedProfile.email],
      subject,
      html,
    });

    if (sendError) {
      console.error('Resend error:', sendError);
      return new Response(
        JSON.stringify({ error: sendError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-notification-email error:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao enviar notificação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
