/**
 * Periodicity helpers: compute current period and whether a date is inside it.
 * Mirrors the cycle logic used in check-periodicity-deadlines Edge Function.
 */

import { differenceInCalendarDays } from 'date-fns';

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

export function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function parseLocalDateOnly(dateOnly: string): Date | null {
  const parts = dateOnly.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0] ?? '', 10);
  const month = parseInt(parts[1] ?? '', 10);
  const day = parseInt(parts[2] ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatLocalDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface PeriodWindow {
  /** Date-only (local) for display and lightweight messaging. */
  periodStart: string;
  /** Date-only (local). Semantics are exclusive: [periodStart, periodEnd). */
  periodEnd: string;
  /** Exact instant (local midnight) that starts the period. */
  periodStartAt: Date;
  /** Exact instant (local midnight) that ends the period (exclusive). */
  periodEndAt: Date;
}

function buildPeriodWindow(periodStartAt: Date, periodEndAt: Date): PeriodWindow {
  return {
    periodStart: formatLocalDateOnly(periodStartAt),
    periodEnd: formatLocalDateOnly(periodEndAt),
    periodStartAt,
    periodEndAt,
  };
}

function computeCurrentWindow(
  config: PeriodicityConfigForCheck,
  now: Date
): { refAt: Date; window: PeriodWindow } | null {
  const refAt = parseLocalDateOnly(config.reference_start_date);
  if (!refAt) return null;

  const intervalDays = getIntervalDays(config);
  const diffDays = differenceInCalendarDays(now, refAt);
  const periodsSinceRef = Math.floor(diffDays / intervalDays);

  const periodStartAt = addDays(refAt, periodsSinceRef * intervalDays);
  const periodEndAt = addDays(periodStartAt, intervalDays);
  return { refAt, window: buildPeriodWindow(periodStartAt, periodEndAt) };
}

/**
 * Returns the current period (start and end dates) that contains `date`, or null if `date` is not inside any period.
 */
export function getCurrentPeriod(
  config: PeriodicityConfigForCheck,
  date: Date = new Date()
): PeriodWindow | null {
  const computed = computeCurrentWindow(config, date);
  if (!computed) return null;

  const { refAt, window } = computed;
  if (date.getTime() < refAt.getTime()) return null;
  if (date.getTime() < window.periodStartAt.getTime() || date.getTime() >= window.periodEndAt.getTime()) return null;
  return window;
}

export type PeriodStatus = 'before' | 'within' | 'after';

export interface PeriodStatusResult {
  status: PeriodStatus;
  currentPeriod: PeriodWindow | null;
  nextPeriodStart: string | null;
  nextPeriodStartAt: Date | null;
}

/**
 * Returns period status (before / within / after), the current period if within, and the next period start for messaging.
 */
export function getPeriodStatus(
  config: PeriodicityConfigForCheck,
  date: Date = new Date()
): PeriodStatusResult {
  const computed = computeCurrentWindow(config, date);
  if (!computed) {
    return { status: 'within', currentPeriod: null, nextPeriodStart: null, nextPeriodStartAt: null };
  }

  const { refAt, window } = computed;

  if (date.getTime() < refAt.getTime()) {
    const nextStart = formatLocalDateOnly(refAt);
    return { status: 'before', currentPeriod: null, nextPeriodStart: nextStart, nextPeriodStartAt: refAt };
  }

  if (date.getTime() >= window.periodStartAt.getTime() && date.getTime() < window.periodEndAt.getTime()) {
    const nextStart = window.periodEnd;
    return {
      status: 'within',
      currentPeriod: window,
      nextPeriodStart: nextStart,
      nextPeriodStartAt: window.periodEndAt,
    };
  }

  // This should be unreachable with the current compute logic, but keep deterministic output.
  const nextStart = window.periodEnd;
  return { status: 'after', currentPeriod: null, nextPeriodStart: nextStart, nextPeriodStartAt: window.periodEndAt };
}

/**
 * Returns true when `date` falls inside the current cycle for the given periodicity config.
 */
export function isInsidePeriodicityWindow(
  config: PeriodicityConfigForCheck | null,
  date: Date = new Date()
): boolean {
  if (!config) return true;
  const { status, currentPeriod } = getPeriodStatus(config, date);
  if (status !== 'within' || !currentPeriod) return false;
  return date.getTime() >= currentPeriod.periodStartAt.getTime() && date.getTime() < currentPeriod.periodEndAt.getTime();
}
