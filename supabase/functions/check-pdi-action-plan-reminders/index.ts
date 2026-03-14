/**
 * PDI Action Plan Reminder — Supabase Edge Function
 *
 * Single source of reminder logic per Supabase guidelines: notification systems and
 * multi-step workflows belong in Edge Functions, not in the frontend or client queries.
 * Invoked by pg_cron (daily) via HTTP; orchestrates DB reads, business rules,
 * in-app notifications (employee + responsible manager), and email notifications.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';
import { corsHeaders } from '../_shared/cors.ts';
import { parseTenantToBranding } from '../_shared/branding.ts';
import { renderPdiActionPlanReminderEmail } from '../_shared/pdi-action-plan-reminder-email.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const resend = new Resend(Deno.env.get('RESEND_API_KEY') ?? '');
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@resend.dev';

/** Days before delivery_date to send the reminder (e.g. 3 = reminder 3 days before). */
const REMINDER_LEAD_DAYS = 3;

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateBr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const today = new Date();
  const reminderDate = addDays(today, REMINDER_LEAD_DAYS);
  const reminderDateStr = toDateOnly(reminderDate);

  // Action plans due in REMINDER_LEAD_DAYS days, not yet reminded
  const { data: plans, error: plansError } = await supabase
    .from('pdi_action_plans')
    .select('id, pdi_id, description, delivery_date')
    .eq('delivery_date', reminderDateStr)
    .is('reminder_sent_at', null);

  if (plansError) {
    console.error('pdi_action_plans fetch error', plansError);
    return new Response(
      JSON.stringify({ error: plansError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const planRows = (plans ?? []) as Array<{
    id: string;
    pdi_id: string;
    description: string;
    delivery_date: string;
  }>;

  if (planRows.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, reminderDate: reminderDateStr, plansProcessed: 0, notificationsCreated: 0, emailsSent: 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const pdiIds = [...new Set(planRows.map((r) => r.pdi_id))];
  const { data: pdisData } = await supabase
    .from('pdis')
    .select('id, employee_id, tenant_id, status')
    .in('id', pdiIds);

  const pdisMap = new Map<string, { id: string; employee_id: string; tenant_id: string }>();
  for (const p of pdisData ?? []) {
    const row = p as { id: string; employee_id: string; tenant_id: string; status: string };
    if (row.status !== 'closed' && row.status !== 'archived') {
      pdisMap.set(row.id, { id: row.id, employee_id: row.employee_id, tenant_id: row.tenant_id });
    }
  }

  const toProcess = planRows.filter((r) => pdisMap.has(r.pdi_id));
  if (toProcess.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, reminderDate: reminderDateStr, plansProcessed: 0, notificationsCreated: 0, emailsSent: 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Batch-fetch manager_id and email for all employees (avoid N+1)
  const employeeIds = [...new Set(toProcess.map((p) => pdisMap.get(p.pdi_id)!.employee_id))];
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, manager_id, email')
    .in('id', employeeIds);
  const managerByEmployee = new Map<string, string | null>();
  const emailByUserId = new Map<string, string>();
  for (const row of profilesData ?? []) {
    const r = row as { id: string; manager_id: string | null; email?: string | null };
    managerByEmployee.set(r.id, r.manager_id ?? null);
    if (r.email?.trim()) emailByUserId.set(r.id, r.email.trim());
  }

  // Batch-fetch manager emails (managers not in employeeIds may still receive notifications)
  const managerIds = [...new Set(
    employeeIds.flatMap((eid) => {
      const mid = managerByEmployee.get(eid);
      return mid && mid !== eid ? [mid] : [];
    })
  )];
  if (managerIds.length > 0) {
    const { data: managerProfiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', managerIds);
    for (const row of managerProfiles ?? []) {
      const r = row as { id: string; email?: string | null };
      if (r.email?.trim()) emailByUserId.set(r.id, r.email.trim());
    }
  }

  // Tenant branding for email (unique tenant ids from toProcess)
  const tenantIds = [...new Set(toProcess.map((p) => pdisMap.get(p.pdi_id)!.tenant_id))];
  const { data: tenantsData } = await supabase
    .from('tenants')
    .select('id, company_name, logo_url, primary_color, accent_color, app_url, slug')
    .in('id', tenantIds);
  const siteUrl = Deno.env.get('SITE_URL') ?? supabaseUrl.replace('.supabase.co', '');
  const brandingByTenant = new Map<string, ReturnType<typeof parseTenantToBranding>>();
  for (const t of tenantsData ?? []) {
    const row = t as { id: string; company_name: string; logo_url?: string | null; primary_color?: string | null; accent_color?: string | null; app_url?: string | null; slug?: string | null };
    const subdomain = row.slug ? `${row.slug}.` : '';
    const appUrl = row.app_url ?? `https://${subdomain}${siteUrl}`;
    brandingByTenant.set(row.id, parseTenantToBranding(row, appUrl));
  }

  let notificationsCreated = 0;
  let emailsSent = 0;
  const reminderSentAt = new Date().toISOString();

  for (const plan of toProcess) {
    const pdi = pdisMap.get(plan.pdi_id);
    if (!pdi) continue;

    const employeeId = pdi.employee_id;
    const tenantId = pdi.tenant_id;
    const pdiId = pdi.id;
    const managerId = managerByEmployee.get(employeeId) ?? null;

    const title = 'Lembrete: plano de ação com data próxima';
    const body = `Entrega em ${formatDateBr(plan.delivery_date)}: ${(plan.description || '').slice(0, 120)}${(plan.description || '').length > 120 ? '...' : ''}`;

    // In-app notification: employee and responsible manager
    const userIds = [employeeId];
    if (managerId && managerId !== employeeId) userIds.push(managerId);

    for (const userId of userIds) {
      const { error: notifErr } = await supabase.from('notifications').insert({
        tenant_id: tenantId,
        user_id: userId,
        type: 'pdi_action_plan_reminder',
        title,
        body,
        related_id: pdiId,
        read_at: null,
      });
      if (!notifErr) notificationsCreated++;
    }

    // Email: employee and manager (if different and has email)
    const branding = brandingByTenant.get(tenantId);
    const appUrl = branding?.appUrl ?? siteUrl;
    const pdiUrl = `${appUrl.replace(/\/$/, '')}/pdi/${pdiId}`;
    const descriptionSnippet = (plan.description || '').trim()
      ? `"${(plan.description || '').slice(0, 120)}${(plan.description || '').length > 120 ? '...' : ''}" `
      : '';
    const html = renderPdiActionPlanReminderEmail({
      branding: branding ?? parseTenantToBranding(null, appUrl),
      deliveryDateBr: formatDateBr(plan.delivery_date),
      descriptionSnippet,
      pdiUrl,
    });
    const subject = `${title} – ${branding?.companyName ?? 'Eleva'}`;

    const emailRecipients = [employeeId];
    if (managerId && managerId !== employeeId) emailRecipients.push(managerId);
    for (const userId of emailRecipients) {
      const email = emailByUserId.get(userId);
      if (!email) continue;
      const { error: emailErr } = await resend.emails.send({
        from: `${branding?.companyName ?? 'Eleva'} <${fromEmail}>`,
        to: [email],
        subject,
        html,
      });
      if (!emailErr) emailsSent++;
    }

    const { error: updateErr } = await supabase
      .from('pdi_action_plans')
      .update({ reminder_sent_at: reminderSentAt })
      .eq('id', plan.id);

    if (updateErr) {
      console.error('reminder_sent_at update error', updateErr);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      reminderDate: reminderDateStr,
      plansProcessed: toProcess.length,
      notificationsCreated,
      emailsSent,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
