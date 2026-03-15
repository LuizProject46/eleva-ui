import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface CreateBackofficeAdminBody {
  email: string;
  password: string;
  name?: string;
}

function emailToName(email: string): string {
  const part = email.split('@')[0] || 'Admin';
  return part.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autorização necessária.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: CreateBackofficeAdminBody;
    try {
      body = (await req.json()) as CreateBackofficeAdminBody;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Corpo da requisição inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminEmail = Deno.env.get('BACKOFFICE_ADMIN_EMAIL') ?? '';
    if (!adminEmail) {
      return new Response(
        JSON.stringify({ error: 'BACKOFFICE_ADMIN_EMAIL não configurado.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminPassword = Deno.env.get('BACKOFFICE_ADMIN_PASSWORD') ?? '';
    if (!adminPassword) {
      return new Response(
        JSON.stringify({ error: 'BACKOFFICE_ADMIN_PASSWORD não configurado.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!adminEmail) {
      return new Response(
        JSON.stringify({ error: 'BACKOFFICE_ADMIN_EMAIL é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!adminPassword || typeof adminPassword !== 'string') {
      return new Response(
        JSON.stringify({ error: 'password é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { name: 'Admin' },
    });

    if (authError) {
      const msg = authError.message ?? '';
      const friendly =
        msg.toLowerCase().includes('already') && (msg.toLowerCase().includes('registered') || msg.toLowerCase().includes('exists'))
          ? 'Este e-mail já está cadastrado.'
          : msg;
      return new Response(
        JSON.stringify({ error: friendly }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData?.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Usuário criado mas id não retornado.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_platform_admin: true })
      .eq('id', userId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message ?? 'Falha ao definir is_platform_admin.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId, adminEmail }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: 'Erro interno.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
