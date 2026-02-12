import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';
import { corsHeaders } from '../_shared/cors.ts';
import { parseTenantToBranding } from '../_shared/branding.ts';
import { formatDateBr, renderPeriodReminderEmail } from '../_shared/period-reminder-email.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

type EntityType = 'evaluation' | 'assessment';
type IntervalKind = 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';

interface PeriodicityConfigRow {
  id: string;
  tenant_id: string;
  entity_type: EntityType;
  interval_kind: IntervalKind;
  custom_interval_days: number | null;
  custom_interval_months: number | null;
  reference_start_date: string;
  notification_lead_days: number[];
  created_at: string;
  updated_at: string;
}

const INTERVAL_MONTHS: Record<IntervalKind, number | null> = {
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
  custom: null,
};

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getIntervalDays(config: PeriodicityConfigRow): number {
  if (config.interval_kind === 'custom') {
    if (config.custom_interval_days != null && config.custom_interval_days > 0) {
      return config.custom_interval_days;
    }
    if (config.custom_interval_months != null && config.custom_interval_months > 0) {
      return config.custom_interval_months * 30;
    }
    return 180;
  }
  const months = INTERVAL_MONTHS[config.interval_kind] ?? 6;
  return months * 30;
}

function getNextPeriod(config: PeriodicityConfigRow, today: Date): { periodStart: Date; periodEnd: Date } | null {
  const ref = new Date(config.reference_start_date + 'T12:00:00Z');
  if (isNaN(ref.getTime())) return null;

  const intervalDays = getIntervalDays(config);
  let periodStart = new Date(ref);
  let periodEnd = addDays(periodStart, intervalDays);

  while (periodEnd <= today) {
    periodStart = periodEnd;
    periodEnd = addDays(periodStart, intervalDays);
  }

  return { periodStart, periodEnd };
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
  const todayStr = toDateOnly(today);

  const { data: configs, error: configError } = await supabase
    .from('periodicity_config')
    .select('id, tenant_id, entity_type, interval_kind, custom_interval_days, custom_interval_months, reference_start_date, notification_lead_days')
    .not('notification_lead_days', 'is', null);

  if (configError) {
    console.error('periodicity_config fetch error', configError);
    return new Response(
      JSON.stringify({ error: configError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const rows = (configs ?? []) as PeriodicityConfigRow[];
  let processed = 0;
  let notificationsCreated = 0;
  let emailsSent = 0;

  for (const config of rows) {
    const leadDaysArr = Array.isArray(config.notification_lead_days)
      ? (config.notification_lead_days as number[]).filter((d) => typeof d === 'number' && d > 0)
      : [];
    if (leadDaysArr.length === 0) continue;

    const next = getNextPeriod(config, today);
    if (!next) continue;

    const periodStartStr = toDateOnly(next.periodStart);
    const periodEndStr = toDateOnly(next.periodEnd);
    const entityLabel = config.entity_type === 'evaluation' ? 'Avaliações 360°' : 'Teste DISC';
    const notificationType =
      config.entity_type === 'evaluation' ? 'evaluation_period_reminder' : 'assessment_period_reminder';

    for (const leadDays of leadDaysArr) {
      const reminderDate = addDays(next.periodStart, -leadDays);
      const reminderDateStr = toDateOnly(reminderDate);
      if (todayStr < reminderDateStr || todayStr > periodStartStr) continue;

      const { data: existing } = await supabase
        .from('periodicity_reminder_sent')
        .select('id')
        .eq('tenant_id', config.tenant_id)
        .eq('entity_type', config.entity_type)
        .eq('period_start_date', periodStartStr)
        .eq('lead_days', leadDays)
        .maybeSingle();

      if (existing) continue;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, name')
        .eq('tenant_id', config.tenant_id)
        .eq('is_active', true);

      const recipients = profiles ?? [];
      if (recipients.length === 0) continue;

      const title =
        config.entity_type === 'evaluation'
          ? `Período de avaliações 360° se aproxima`
          : `Período do teste DISC se aproxima`;
      const body = `${entityLabel}: período de ${formatDateBr(periodStartStr)} a ${formatDateBr(periodEndStr)}. Notificação com ${leadDays} dias de antecedência.`;

      for (const profile of recipients) {
        const { error: notifErr } = await supabase.from('notifications').insert({
          tenant_id: config.tenant_id,
          user_id: profile.id,
          type: notificationType,
          title,
          body,
          related_id: null,
          read_at: null,
        });
        if (!notifErr) notificationsCreated++;
      }

      const { error: sentErr } = await supabase.from('periodicity_reminder_sent').insert({
        tenant_id: config.tenant_id,
        entity_type: config.entity_type,
        period_start_date: periodStartStr,
        lead_days: leadDays,
      });

      if (sentErr) {
        console.error('periodicity_reminder_sent insert error', sentErr);
        continue;
      }

      processed++;

      const { data: tenant } = await supabase
        .from('tenants')
        .select('company_name, logo_url, primary_color, accent_color, app_url, slug')
        .eq('id', config.tenant_id)
        .maybeSingle();

      const siteUrl = Deno.env.get('SITE_URL') ?? supabaseUrl.replace('.supabase.co', '');
      const subdomain = tenant?.slug ? `${tenant.slug}.` : '';
      const appUrl = tenant?.app_url ?? `https://${subdomain}${siteUrl}`;
      const branding = parseTenantToBranding(tenant, appUrl);

      const resend = new Resend(Deno.env.get('RESEND_API_KEY') ?? '');
      const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@resend.dev';
      const html = renderPeriodReminderEmail({
        branding,
        entityType: config.entity_type,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        leadDays,
      });
      const subject = `${entityLabel} – período ${periodStartStr} a ${periodEndStr} – ${branding.companyName}`;

      for (const profile of recipients) {
        if (!profile.email) continue;
        const { error: emailErr } = await resend.emails.send({
          from: `${branding.companyName} <${fromEmail}>`,
          to: [profile.email],
          subject,
          html,
        });
        if (!emailErr) emailsSent++;
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      configsChecked: rows.length,
      remindersProcessed: processed,
      notificationsCreated,
      emailsSent,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
