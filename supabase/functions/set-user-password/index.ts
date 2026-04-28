import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const MIN_PASSWORD_LENGTH = 6;

interface SetUserPasswordBody {
  user_id: string;
  new_password: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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

    const callerId = claimsData.claims.sub as string;

    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', callerId)
      .single();

    if (callerError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerRole = callerProfile.role as string;
    if (callerRole !== 'hr') {
      return new Response(
        JSON.stringify({ error: 'Apenas RH pode definir a senha de outros usuários.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as SetUserPasswordBody;
    const targetUserId = body?.user_id?.trim();
    const newPassword = body?.new_password ?? '';

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'user_id é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      return new Response(
        JSON.stringify({ error: `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetUserId === callerId) {
      return new Response(
        JSON.stringify({ error: 'Para alterar sua própria senha, use Configurações.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerTenantId = callerProfile.tenant_id as string | null;
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetTenantId = targetProfile.tenant_id as string | null;
    if (callerTenantId !== targetTenantId) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para alterar senha de usuário de outro tenant.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RH está definindo credenciais no tenant: confirmar e-mail no Auth para não bloquear login com email_not_confirmed.
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
      email_confirm: true,
    });

    if (updateError) {
      console.error('updateUserById error:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message ?? 'Erro ao definir senha.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao definir senha.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
