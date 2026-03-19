import { Resend } from 'npm:resend@4.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { parseTenantToBranding } from '../_shared/branding.ts';
import { renderPdiEvidenceApprovedEmail } from './_templates/pdi-evidence-approved.ts';
import { renderPdiEvidenceRejectedEmail } from './_templates/pdi-evidence-rejected.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') ?? '');
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

type ReviewStatus = 'approved' | 'rejected';

interface InvokeBody {
  evidence_id: string;
  review_status: ReviewStatus;
  feedback?: string | null;
}

function buildPdiEvidenceSubject(params: { status: ReviewStatus; companyName: string }): string {
  const { status, companyName } = params;
  return status === 'approved' ? `Sua evidência foi aprovada - ${companyName}` : `Sua evidência foi rejeitada - ${companyName}`;
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
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
      return new Response(JSON.stringify({ error: 'Autorização necessária' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token não encontrado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerUserId = claimsData.claims.sub as string;
    const body = (await req.json()) as InvokeBody;
    const { evidence_id: evidenceId, review_status: reviewStatus, feedback } = body;

    if (!evidenceId || !reviewStatus) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios: evidence_id, review_status' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (reviewStatus !== 'approved' && reviewStatus !== 'rejected') {
      return new Response(JSON.stringify({ error: 'review_status inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: managerProfile, error: managerProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, name, role, tenant_id')
      .eq('id', callerUserId)
      .maybeSingle();

    if (managerProfileErr || !managerProfile) {
      return new Response(JSON.stringify({ error: 'Gestor não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (managerProfile.role !== 'manager') {
      return new Response(JSON.stringify({ error: 'Apenas gestores podem notificar revisões' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: evidenceRow, error: evidenceErr } = await supabaseAdmin
      .from('pdi_evidences')
      .select('id, status, tenant_id, pdi_id, submitted_by, file_name')
      .eq('id', evidenceId)
      .maybeSingle();

    if (evidenceErr || !evidenceRow) {
      return new Response(JSON.stringify({ error: 'Evidência não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (evidenceRow.status !== reviewStatus) {
      // Avoid sending wrong notifications if the DB review failed or race happened.
      return new Response(JSON.stringify({ error: 'Status da evidência não corresponde à revisão solicitada' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: pdiRow, error: pdiErr } = await supabaseAdmin
      .from('pdis')
      .select('id, employee_id, tenant_id')
      .eq('id', evidenceRow.pdi_id)
      .maybeSingle();

    if (pdiErr || !pdiRow) {
      return new Response(JSON.stringify({ error: 'PDI não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (pdiRow.employee_id !== evidenceRow.submitted_by || pdiRow.tenant_id !== evidenceRow.tenant_id) {
      return new Response(JSON.stringify({ error: 'Evidência fora do escopo do PDI' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (pdiRow.tenant_id !== managerProfile.tenant_id) {
      return new Response(JSON.stringify({ error: 'Sem escopo de tenant para revisar esta evidência' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: collaboratorProfile, error: collaboratorErr } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, manager_id')
      .eq('id', evidenceRow.submitted_by)
      .maybeSingle();

    if (collaboratorErr || !collaboratorProfile) {
      return new Response(JSON.stringify({ error: 'Colaborador não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (collaboratorProfile.manager_id !== callerUserId) {
      return new Response(JSON.stringify({ error: 'Sem permissão para notificar este colaborador' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert in-app notification
    const type = reviewStatus === 'approved' ? 'pdi_evidence_approved' : 'pdi_evidence_rejected';
    const cleanFeedback = normalizeText(feedback);

    const title = reviewStatus === 'approved' ? 'Evidência aprovada' : 'Evidência rejeitada';
    const bodyText = reviewStatus === 'approved'
      ? `${managerProfile.name} aprovou uma evidência enviada por você.`
      : `${managerProfile.name} rejeitou uma evidência enviada por você.${cleanFeedback ? `\n\nFeedback: ${cleanFeedback}` : ''}`;

    const { error: insertNotifErr } = await supabaseAdmin.from('notifications').insert({
      tenant_id: evidenceRow.tenant_id,
      user_id: evidenceRow.submitted_by,
      type,
      title,
      body: bodyText,
      related_id: evidenceRow.id,
    });

    if (insertNotifErr) {
      console.error('pdi-evidence-review-notify: notification insert error', insertNotifErr);
      // Continue to email even if notification fails.
    }

    // Send email
    const { data: tenantRow } = await supabaseAdmin
      .from('tenants')
      .select('company_name, logo_url, primary_color, accent_color, app_url, slug')
      .eq('id', evidenceRow.tenant_id)
      .maybeSingle();

    const subdomain = `${tenantRow?.slug ? tenantRow.slug : ''}`;
    const domain = Deno.env.get('SITE_URL') ?? supabaseUrl.replace('.supabase.co', '');
    const siteUrl = `https://${subdomain ? `${subdomain}.${domain}` : domain}`;

    const branding = parseTenantToBranding(tenantRow, siteUrl);
    const appUrl = branding.appUrl.replace(/\/$/, '');
    const pdiUrl = `${appUrl}/pdis/${evidenceRow.pdi_id}`;

    const emailSubject = buildPdiEvidenceSubject({ status: reviewStatus, companyName: branding.companyName });

    const html = reviewStatus === 'approved'
      ? renderPdiEvidenceApprovedEmail({
        branding,
        managerName: managerProfile.name ?? 'Gestor',
        collaboratorName: collaboratorProfile.name ?? 'Colaborador',
        pdiUrl,
        fileName: evidenceRow.file_name,
      })
      : renderPdiEvidenceRejectedEmail({
        branding,
        managerName: managerProfile.name ?? 'Gestor',
        collaboratorName: collaboratorProfile.name ?? 'Colaborador',
        pdiUrl,
        fileName: evidenceRow.file_name,
        feedback: cleanFeedback,
      });

    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@resend.dev';

    if (collaboratorProfile.email) {
      const { error: sendErr } = await resend.emails.send({
        from: `${branding.companyName} <${fromEmail}>`,
        to: [collaboratorProfile.email],
        subject: emailSubject,
        html,
      });

      if (sendErr) {
        console.error('pdi-evidence-review-notify: resend error', sendErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('pdi-evidence-review-notify error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno ao notificar evidência' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

