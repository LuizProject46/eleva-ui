/**
 * Dashboard metrics — Supabase Edge Function
 *
 * Returns role-scoped dashboard data (HR / Manager / Employee) using the
 * caller's JWT so RLS applies. Single response with metrics and recent activity.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CLOSE_TO_DEADLINE_DAYS = 7;
const RECENT_ACTIVITY_LIMIT = 10;
const RECENT_ACTIVITY_LIMIT_EMPLOYEE = 5;

type DashboardRole = 'hr' | 'manager' | 'employee';

interface RecentActivityItem {
  pdiId: string;
  employeeName?: string | null;
  updatedAt: string;
  title?: string | null;
}

interface HrMetrics {
  totalCollaborators: number;
  totalPdis: number;
  activePdis: number;
  overdueActionPlans: number;
  closeToDeadlineActionPlans: number;
}

interface ManagerMetrics {
  teamSize: number;
  totalPdis: number;
  activePdis: number;
  overdueActionPlans: number;
  closeToDeadlineActionPlans: number;
}

interface EmployeeMetrics {
  hasActivePdi: boolean;
  activePdiId?: string | null;
  totalActionPlans: number;
  overdueActionPlans: number;
  closeToDeadlineActionPlans: number;
}

interface DashboardResponse {
  role: DashboardRole;
  metrics: HrMetrics | ManagerMetrics | EmployeeMetrics;
  recentActivity: RecentActivityItem[];
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
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

  const authClient = createClient(supabaseUrl, anonKey);
  let userId: string;
  try {
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      const { data: userData, error: userError } = await authClient.auth.getUser(token);
      if (userError || !userData?.user?.id) {
        return new Response(
          JSON.stringify({
            error: 'Token inválido ou expirado. Faça login novamente.',
            detail: claimsError?.message ?? userError?.message ?? null,
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = userData.user.id;
    } else {
      userId = claimsData.claims.sub as string;
    }
  } catch (authErr) {
    console.error('get-dashboard-metrics auth error', authErr);
    return new Response(
      JSON.stringify({
        error: 'Token inválido ou expirado. Faça login novamente.',
        detail: authErr instanceof Error ? authErr.message : null,
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const today = toDateOnly(new Date());
  const d = new Date();
  d.setDate(d.getDate() + CLOSE_TO_DEADLINE_DAYS);
  const nextWeek = toDateOnly(d);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({
        error: 'Perfil não encontrado.',
        detail: profileError?.message ?? null,
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const role = (profile.role ?? 'employee') as DashboardRole;
  if (role !== 'hr' && role !== 'manager' && role !== 'employee') {
    return new Response(
      JSON.stringify({ error: 'Perfil sem role válida.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    if (role === 'hr') {
      const [collabRes, pdisAllRes, pdisActiveRes, overdueRes, closeRes, activityRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('pdis').select('id', { count: 'exact', head: true }),
        supabase.from('pdis').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('pdi_action_plans').select('id', { count: 'exact', head: true }).lt('delivery_date', today),
        supabase
          .from('pdi_action_plans')
          .select('id', { count: 'exact', head: true })
          .gte('delivery_date', today)
          .lte('delivery_date', nextWeek),
        supabase
          .from('pdis')
          .select('id, updated_at, title, employee_id')
          .order('updated_at', { ascending: false })
          .limit(RECENT_ACTIVITY_LIMIT),
      ]);

      const activityRows = (activityRes.data ?? []) as Array<{
        id: string;
        updated_at: string;
        title: string | null;
        employee_id: string;
      }>;
      const employeeIds = [...new Set(activityRows.map((r) => r.employee_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (employeeIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', employeeIds);
        (profiles ?? []).forEach((p: { id: string; name: string | null }) => {
          nameMap[p.id] = p.name ?? '';
        });
      }
      const recentActivity: RecentActivityItem[] = activityRows.map((row) => ({
        pdiId: row.id,
        employeeName: row.employee_id ? nameMap[row.employee_id] ?? null : null,
        updatedAt: row.updated_at,
        title: row.title ?? null,
      }));

      const response: DashboardResponse = {
        role: 'hr',
        metrics: {
          totalCollaborators: collabRes.count ?? 0,
          totalPdis: pdisAllRes.count ?? 0,
          activePdis: pdisActiveRes.count ?? 0,
          overdueActionPlans: overdueRes.count ?? 0,
          closeToDeadlineActionPlans: closeRes.count ?? 0,
        },
        recentActivity,
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (role === 'manager') {
      const [teamRes, pdisAllRes, pdisActiveRes, overdueRes, closeRes, activityRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('manager_id', userId),
        supabase.from('pdis').select('id', { count: 'exact', head: true }),
        supabase.from('pdis').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('pdi_action_plans').select('id', { count: 'exact', head: true }).lt('delivery_date', today),
        supabase
          .from('pdi_action_plans')
          .select('id', { count: 'exact', head: true })
          .gte('delivery_date', today)
          .lte('delivery_date', nextWeek),
        supabase
          .from('pdis')
          .select('id, updated_at, title, employee_id')
          .order('updated_at', { ascending: false })
          .limit(RECENT_ACTIVITY_LIMIT),
      ]);

      const activityRows = (activityRes.data ?? []) as Array<{
        id: string;
        updated_at: string;
        title: string | null;
        employee_id: string;
      }>;
      const employeeIds = [...new Set(activityRows.map((r) => r.employee_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (employeeIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', employeeIds);
        (profiles ?? []).forEach((p: { id: string; name: string | null }) => {
          nameMap[p.id] = p.name ?? '';
        });
      }
      const recentActivity: RecentActivityItem[] = activityRows.map((row) => ({
        pdiId: row.id,
        employeeName: row.employee_id ? nameMap[row.employee_id] ?? null : null,
        updatedAt: row.updated_at,
        title: row.title ?? null,
      }));

      const response: DashboardResponse = {
        role: 'manager',
        metrics: {
          teamSize: teamRes.count ?? 0,
          totalPdis: pdisAllRes.count ?? 0,
          activePdis: pdisActiveRes.count ?? 0,
          overdueActionPlans: overdueRes.count ?? 0,
          closeToDeadlineActionPlans: closeRes.count ?? 0,
        },
        recentActivity,
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [activePdiRes, actionPlansRes, overdueRes, closeRes, activityRes] = await Promise.all([
      supabase
        .from('pdis')
        .select('id')
        .eq('employee_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
      supabase.from('pdi_action_plans').select('id', { count: 'exact', head: true }),
      supabase.from('pdi_action_plans').select('id', { count: 'exact', head: true }).lt('delivery_date', today),
      supabase
        .from('pdi_action_plans')
        .select('id', { count: 'exact', head: true })
        .gte('delivery_date', today)
        .lte('delivery_date', nextWeek),
      supabase
        .from('pdis')
        .select('id, updated_at, title')
        .eq('employee_id', userId)
        .order('updated_at', { ascending: false })
        .limit(RECENT_ACTIVITY_LIMIT_EMPLOYEE),
    ]);

    const activePdi = activePdiRes.data as { id: string } | null;
    const activePdiId = activePdi?.id ?? null;

    const recentActivity: RecentActivityItem[] = ((activityRes.data ?? []) as Array<{
      id: string;
      updated_at: string;
      title: string | null;
    }>).map((row) => ({
      pdiId: row.id,
      employeeName: null,
      updatedAt: row.updated_at,
      title: row.title ?? null,
    }));

    const response: DashboardResponse = {
      role: 'employee',
      metrics: {
        hasActivePdi: !!activePdiId,
        activePdiId,
        totalActionPlans: actionPlansRes.count ?? 0,
        overdueActionPlans: overdueRes.count ?? 0,
        closeToDeadlineActionPlans: closeRes.count ?? 0,
      },
      recentActivity,
    };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('get-dashboard-metrics error', err);
    return new Response(
      JSON.stringify({
        error: 'Erro ao carregar métricas do dashboard.',
        detail: message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
