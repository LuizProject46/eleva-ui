import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

type EntityType = 'evaluation' | 'assessment';

interface Body {
  entity_type: EntityType;
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

  const supabaseAuth = createClient(supabaseUrl, anonKey);
  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

  if (claimsError || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: 'Token inválido ou expirado. Faça login novamente.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = claimsData.claims.sub as string;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', userId)
    .single();

  if (profile?.role !== 'hr' || !profile?.tenant_id) {
    return new Response(JSON.stringify({ error: 'Apenas RH pode redefinir lembretes de período' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: 'Corpo da requisição inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const entityType = body?.entity_type;
  if (!entityType || (entityType !== 'evaluation' && entityType !== 'assessment')) {
    return new Response(JSON.stringify({ error: 'entity_type deve ser evaluation ou assessment' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('periodicity_reminder_sent')
    .delete()
    .eq('tenant_id', profile.tenant_id)
    .eq('entity_type', entityType);

  if (deleteError) {
    console.error('reset-periodicity-reminders delete error', deleteError);
    return new Response(
      JSON.stringify({ error: deleteError.message ?? 'Erro ao redefinir lembretes' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
