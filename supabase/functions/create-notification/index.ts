import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

interface InvokeBody {
  tenant_id: string;
  user_id: string;
  type: 'evaluation_received' | 'feedback_received';
  title: string;
  body: string | null;
  related_id: string | null;
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
    const { tenant_id, user_id, type, title, body: bodyText, related_id } = body;

    if (!tenant_id || !user_id || !type || !title) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: tenant_id, user_id, type, title' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type !== 'evaluation_received' && type !== 'feedback_received') {
      return new Response(
        JSON.stringify({ error: 'type deve ser evaluation_received ou feedback_received' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (related_id) {
      const { data: evaluation, error: evalError } = await supabaseAdmin
        .from('evaluations')
        .select('evaluator_id')
        .eq('id', related_id)
        .maybeSingle();

      if (evalError) {
        console.error('create-notification: evaluation lookup error', evalError);
        return new Response(
          JSON.stringify({ error: 'Erro ao validar avaliação' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (evaluation && evaluation.evaluator_id !== claimsData.claims.sub) {
        return new Response(
          JSON.stringify({ error: 'Não autorizado a criar notificação para esta avaliação' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { error: insertError } = await supabaseAdmin.from('notifications').insert({
      tenant_id,
      user_id,
      type,
      title,
      body: bodyText ?? null,
      related_id: related_id ?? null,
    });

    if (insertError) {
      console.error('create-notification: insert error', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-notification error:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao criar notificação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
