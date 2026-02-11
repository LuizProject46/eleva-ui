/**
 * Periodicity helpers: compute current period and whether a date is inside it.
 * Mirrors the cycle logic used in check-periodicity-deadlines Edge Function.
 */

export type IntervalKind = 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';

export interface PeriodicityConfigForCheck {
  reference_start_date: string;
  interval_kind: IntervalKind;
  custom_interval_days: number | null;
  custom_interval_months: number | null;
}

const INTERVAL_DAYS: Record<IntervalKind, number> = {
  bimonthly: 60,
  quarterly: 90,
  semiannual: 180,
  annual: 360,
  custom: 0,
};

function getIntervalDays(config: PeriodicityConfigForCheck): number {
  if (config.interval_kind === 'custom') {
    if (config.custom_interval_days != null && config.custom_interval_days > 0) {
      return config.custom_interval_days;
    }
    if (config.custom_interval_months != null && config.custom_interval_months > 0) {
      return config.custom_interval_months * 30;
    }
    return 180;
  }
  return INTERVAL_DAYS[config.interval_kind] ?? 180;
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the current period (start and end dates) that contains `date`, or null if `date` is not inside any period.
 */
export function getCurrentPeriod(
  config: PeriodicityConfigForCheck,
  date: Date = new Date()
): { periodStart: string; periodEnd: string } | null {
  const ref = new Date(config.reference_start_date + 'T12:00:00Z');
  if (isNaN(ref.getTime())) return null;

  const intervalDays = getIntervalDays(config);
  let periodStart = new Date(ref);
  let periodEnd = addDays(periodStart, intervalDays);
  const dateStr = toDateOnly(date);

  while (toDateOnly(periodEnd) < dateStr) {
    periodStart = periodEnd;
    periodEnd = addDays(periodStart, intervalDays);
  }

  const startStr = toDateOnly(periodStart);
  const endStr = toDateOnly(periodEnd);
  if (dateStr >= startStr && dateStr <= endStr) {
    return { periodStart: startStr, periodEnd: endStr };
  }
  return null;
}

/**
 * Returns true when `date` falls inside the current cycle for the given periodicity config.
 */
export function isInsidePeriodicityWindow(
  config: PeriodicityConfigForCheck | null,
  date: Date = new Date()
): boolean {
  if (!config) return true;
  return getCurrentPeriod(config, date) !== null;
}
