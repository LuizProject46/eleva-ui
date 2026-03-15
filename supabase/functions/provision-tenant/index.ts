import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';
import { corsHeaders } from '../_shared/cors.ts';
import { sendOnboardingEmail } from '../_shared/onboarding-email.ts';

interface ProvisionBody {
  company_name: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
  user_limit: number;
  slug?: string;
}

function deriveSlug(companyName: string): string {
  const normalized = companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'tenant';
}

function randomSuffix(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function resolveSlug(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyName: string,
  explicitSlug?: string
): Promise<{ slug: string; error?: string }> {
  let slug: string;
  if (explicitSlug?.trim()) {
    slug = explicitSlug.trim().toLowerCase().replace(/\s+/g, '-');
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return { slug: '', error: 'Slug deve conter apenas letras minúsculas, números e hífens.' };
    }
  } else {
    slug = deriveSlug(companyName);
  }

  const { data: existing } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!existing) {
    return { slug };
  }

  let candidate = `${slug}-${randomSuffix()}`;
  let attempts = 0;
  while (attempts < 10) {
    const { data: taken } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!taken) return { slug: candidate };
    candidate = `${slug}-${randomSuffix()}`;
    attempts += 1;
  }
  return { slug: `${slug}-${Date.now().toString(36)}` };
}

async function ensurePlatformAdminOrSecret(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<{ allowed: boolean; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { allowed: false, error: 'Autorização necessária.' };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { allowed: false, error: 'Token não encontrado.' };
  }

  const provisioningSecret = Deno.env.get('PROVISIONING_SECRET');
  if (provisioningSecret && token === provisioningSecret) {
    return { allowed: true };
  }

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );
  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

  if (claimsError || !claimsData?.claims?.sub) {
    return { allowed: false, error: 'Token inválido ou expirado.' };
  }

  const userId = claimsData.claims.sub as string;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', userId)
    .single();

  if (profile?.is_platform_admin !== true) {
    return { allowed: false, error: 'Apenas administradores da plataforma podem provisionar tenants.' };
  }

  return { allowed: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authResult = await ensurePlatformAdminOrSecret(req, supabaseAdmin);
    if (!authResult.allowed) {
      return new Response(
        JSON.stringify({ error: authResult.error ?? 'Não autorizado.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: ProvisionBody;
    try {
      body = (await req.json()) as ProvisionBody;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Corpo da requisição inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { company_name, admin_name, admin_email, admin_password, user_limit, slug } = body;

    if (!company_name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'company_name é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!admin_name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'admin_name é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!admin_email?.trim()) {
      return new Response(
        JSON.stringify({ error: 'admin_email é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!admin_password || typeof admin_password !== 'string') {
      return new Response(
        JSON.stringify({ error: 'admin_password é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (typeof user_limit !== 'number' || user_limit < 0) {
      return new Response(
        JSON.stringify({ error: 'user_limit deve ser um número maior ou igual a zero.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const slugResult = await resolveSlug(supabaseAdmin, company_name.trim(), slug);
    if (slugResult.error) {
      return new Response(
        JSON.stringify({ error: slugResult.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: tenant, error: insertError } = await supabaseAdmin
      .from('tenants')
      .insert({
        slug: slugResult.slug,
        company_name: company_name.trim(),
        max_users: user_limit,
        is_active: true,
      })
      .select('id')
      .single();

    if (insertError || !tenant) {
      return new Response(
        JSON.stringify({ error: insertError?.message ?? 'Falha ao criar tenant.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenant.id as string;

    const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email.trim(),
      password: admin_password,
      email_confirm: true,
      user_metadata: {
        name: admin_name.trim(),
        role: 'hr',
        tenant_id: tenantId,
      },
    });

    if (createUserError) {
      await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
      const msg = createUserError.message ?? '';
      const friendly =
        msg.toLowerCase().includes('already') && (msg.toLowerCase().includes('registered') || msg.toLowerCase().includes('exists'))
          ? 'Este e-mail já está cadastrado.'
          : msg || 'Falha ao criar usuário administrador.';
      return new Response(
        JSON.stringify({ error: friendly }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let onboardingEmailSent = true;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const tenantSlug = slugResult.slug;
    const siteUrl = (Deno.env.get('SITE_URL') ?? Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
    const baseUrl = siteUrl ? `${tenantSlug}.${siteUrl}` : '';
    const loginUrl = siteUrl ? `${baseUrl}/login?tenant=${encodeURIComponent(slugResult.slug)}` : '';

    if (resendApiKey && loginUrl) {
      const resend = new Resend(resendApiKey);
      const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@resend.dev';
      const sendResult = await sendOnboardingEmail(resend, admin_email.trim(), {
        companyName: company_name.trim(),
        adminEmail: admin_email.trim(),
        adminPassword: admin_password,
        loginUrl,
        adminName: admin_name?.trim() || undefined,
      }, fromEmail, company_name.trim());
      if (sendResult.error) {
        console.error('Onboarding email send failed:', sendResult.error);
        onboardingEmailSent = false;
      }
    } else {
      if (!resendApiKey) console.warn('RESEND_API_KEY not set; skipping onboarding email.');
      if (!loginUrl) console.warn('SITE_URL not set; skipping onboarding email.');
      onboardingEmailSent = false;
    }

    return new Response(
      JSON.stringify({
        tenant_id: tenantId,
        user_id: userData?.user?.id,
        slug: slugResult.slug,
        ...(onboardingEmailSent === false && { onboarding_email_sent: false }),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao provisionar tenant.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
