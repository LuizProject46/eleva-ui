import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface RpcBody {
  p_past_cycles?: number;
  p_future_cycles?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const enabled = Deno.env.get('AUTO_EVALUATION_PERIODS_ENABLED');
  if (enabled === 'false' || enabled === '0') {
    return new Response(
      JSON.stringify({
        ok: true,
        skipped: true,
        reason: 'AUTO_EVALUATION_PERIODS_DISABLED',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let pastCycles = 2;
  let futureCycles = 6;
  if (req.method === 'POST') {
    try {
      const body = (await req.json()) as RpcBody;
      if (typeof body?.p_past_cycles === 'number' && body.p_past_cycles >= 0 && body.p_past_cycles <= 24) {
        pastCycles = Math.floor(body.p_past_cycles);
      }
      if (typeof body?.p_future_cycles === 'number' && body.p_future_cycles >= 0 && body.p_future_cycles <= 36) {
        futureCycles = Math.floor(body.p_future_cycles);
      }
    } catch {
      // empty body is fine
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc('generate_evaluation_periods_all_tenants', {
    p_past_cycles: pastCycles,
    p_future_cycles: futureCycles,
  });

  if (error) {
    console.error('generate_evaluation_periods_all_tenants', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const summary = data as Record<string, unknown>;
  const ok = summary?.ok === true;
  console.log(JSON.stringify({ event: 'auto_generate_evaluation_periods', ...summary, pastCycles, futureCycles }));

  return new Response(JSON.stringify({ ok, ...summary, pastCycles, futureCycles }), {
    status: ok ? 200 : 207,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
