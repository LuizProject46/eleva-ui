/**
 * Sends email to an employee when they are assigned to a course (optional or mandatory).
 * Invoked by the frontend after assignCourseToUsers (in-app notification is created by DB trigger).
 * Payload: user_id, course_id (course title, description, type loaded from DB).
 */
import { Resend } from 'npm:resend@4.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { parseTenantToBranding } from '../_shared/branding.ts';
import { renderMandatoryCourseAssignedEmail } from './_templates/mandatory-course-assigned.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') ?? '');
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

interface InvokeBody {
  user_id: string;
  course_id: string;
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
    const { user_id, course_id } = body;

    if (!user_id || !course_id) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: user_id, course_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email, tenant_id')
      .eq('id', user_id)
      .maybeSingle();

    if (profileError || !profile?.email) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('title, description, type')
      .eq('id', course_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: 'Curso não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let tenant: {
      company_name: string;
      logo_url?: string | null;
      primary_color?: string | null;
      accent_color?: string | null;
      slug?: string | null;
      app_url?: string | null;
    } | null = null;

    if (profile.tenant_id) {
      const { data: t } = await supabaseAdmin
        .from('tenants')
        .select('company_name, logo_url, primary_color, accent_color, slug, app_url')
        .eq('id', profile.tenant_id)
        .maybeSingle();
      tenant = t;
    }

    const domain = Deno.env.get('SITE_URL') ?? supabaseUrl.replace('.supabase.co', '');
    const subdomain = tenant?.slug ? tenant.slug : '';
    const siteUrl = subdomain ? `https://${subdomain}.${domain}` : `https://${domain}`;
    const branding = parseTenantToBranding(tenant, siteUrl);

    const isMandatory = course.type === 'mandatory';
    const subject = isMandatory
      ? `Novo curso obrigatório: ${course.title} - ${branding.companyName}`
      : `Novo curso atribuído: ${course.title} - ${branding.companyName}`;
    const description = course.description ? String(course.description).slice(0, 200) : '';
    const html = renderMandatoryCourseAssignedEmail({
      branding,
      courseTitle: course.title,
      courseDescription: description,
      isMandatory,
    });

    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@resend.dev';

    const { error: sendError } = await resend.emails.send({
      from: `${branding.companyName} <${fromEmail}>`,
      to: [profile.email],
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
    console.error('send-mandatory-course-email error:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao enviar e-mail' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
