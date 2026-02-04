import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface DeleteUserBody {
  user_id: string;
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
        JSON.stringify({ error: 'Apenas RH pode excluir usuários.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as DeleteUserBody;
    const targetUserId = body?.user_id?.trim();
    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'user_id é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetUserId === callerId) {
      return new Response(
        JSON.stringify({ error: 'Você não pode excluir sua própria conta.' }),
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
        JSON.stringify({ error: 'Sem permissão para excluir usuário de outro tenant.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clear manager_id references so CASCADE can delete the profile when we delete auth user
    const { error: unrefError } = await supabaseAdmin
      .from('profiles')
      .update({ manager_id: null })
      .eq('manager_id', targetUserId);

    if (unrefError) {
      console.error('Failed to clear manager_id references:', unrefError);
      return new Response(
        JSON.stringify({ error: 'Erro ao preparar exclusão. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service role: remove auth user (profile is cascade-deleted from auth.users)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      console.error('deleteUser error:', deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message ?? 'Erro ao excluir usuário.' }),
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
      JSON.stringify({ error: 'Erro interno ao excluir usuário.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
