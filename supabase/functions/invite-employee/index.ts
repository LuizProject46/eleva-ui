import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type InviteRole = 'employee' | 'manager' | 'hr';

interface InviteBody {
  email: string;
  name: string;
  position: string;
  department: string;
  manager_id: string;
  cost_center?: string;
  role?: InviteRole;
}

function isEmailRateLimitError(message: string): boolean {
  const lower = message?.toLowerCase() ?? '';
  return lower.includes('rate limit') || lower.includes('rate_limit') || lower.includes('quota') || lower.includes('too many');
}

function toFriendlyEmailError(message: string): string {
  const lower = message?.toLowerCase() ?? '';
  if (lower.includes('already') && (lower.includes('registered') || lower.includes('exists'))) {
    return 'Este e-mail já está cadastrado.';
  }
  if (lower.includes('invalid') && lower.includes('email')) {
    return 'E-mail inválido. Verifique e tente novamente.';
  }
  if (isEmailRateLimitError(lower)) {
    return 'Limite de envio de e-mails atingido. O usuário será criado sem envio de convite.';
  }
  return message || 'Não foi possível enviar o convite. Tente novamente mais tarde.';
}

function randomPassword(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autorização necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token não encontrado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', userId)
      .single();

    const callerRole = profile?.role as string | undefined;
    if (callerRole !== 'hr') {
      return new Response(
        JSON.stringify({ error: 'Apenas RH pode criar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as InviteBody;
    const { email, name, position, department, manager_id, cost_center, role: bodyRole } = body;

    const inviteRole: InviteRole = bodyRole && ['employee', 'manager', 'hr'].includes(bodyRole)
      ? bodyRole
      : 'employee';

    if (!email || !name || !position || !department) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: email, name, position, department' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (inviteRole === 'employee' && !manager_id) {
      return new Response(
        JSON.stringify({ error: 'Gestor/equipe é obrigatório para colaborador' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let inviteData: { user?: { id: string; email?: string } } | null = null;
    let inviteError: { message?: string } | null = null;

    const inviteResult = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        name,
        role: inviteRole,
        position,
        department,
        ...(manager_id && { manager_id }),
        tenant_id: tenantId,
        ...(cost_center && { cost_center }),
      },
    });
    inviteData = inviteResult.data;
    inviteError = inviteResult.error;

    if (inviteError) {
      const msg = inviteError.message ?? '';

      if (isEmailRateLimitError(msg)) {
        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: randomPassword(),
          email_confirm: true,
          user_metadata: {
            name,
            role: inviteRole,
            position,
            department,
            ...(manager_id && { manager_id }),
            tenant_id: tenantId,
            ...(cost_center && { cost_center }),
          },
        });

        if (createError) {
          return new Response(
            JSON.stringify({ error: toFriendlyEmailError(createError.message ?? msg) }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            user: createData?.user,
            emailPending: true,
            message: 'Usuário criado. O e-mail de convite não foi enviado devido ao limite de envio; o colaborador pode usar "Esqueci a senha" para definir a senha.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: toFriendlyEmailError(msg) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user: inviteData?.user }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao enviar convite' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
