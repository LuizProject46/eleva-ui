import type { TenantEvaluationPeriod } from '@/types/evaluationPeriod';

function yearFromDateOnly(iso: string): number {
  const y = parseInt(iso.slice(0, 4), 10);
  return Number.isFinite(y) ? y : NaN;
}

function legacySemesterTwo(period: Pick<TenantEvaluationPeriod, 'semester' | 'starts_at'>): boolean {
  if (period.semester != null) {
    return Number(period.semester) === 2;
  }
  const raw = period.starts_at;
  if (raw == null || raw === '') return false;
  const m = /^(\d{4})-(\d{2})-/.exec(raw);
  if (!m) return false;
  const month = parseInt(m[2], 10);
  if (!Number.isFinite(month)) return false;
  return month > 6;
}

/**
 * When competency-based 9-box applies for a period.
 * Must stay aligned with public.generate_competency_nine_box_snapshot.
 *
 * Auto-generated rows: eligible from the 2nd cycle in the calendar year of `auto_cycle_start_date`
 * (among tenant auto `evaluation` periods). Legacy/manual rows: semester 2 or 2nd calendar half from starts_at.
 */
export function isEvaluationPeriodCompetencyNineBox(
  period: TenantEvaluationPeriod,
  allTenantEvaluationPeriods?: TenantEvaluationPeriod[]
): boolean {
  const isAuto = period.is_auto_generated === true;
  const cycleStart = period.auto_cycle_start_date;

  if (isAuto && cycleStart != null && cycleStart !== '') {
    const list = allTenantEvaluationPeriods ?? [];
    const y = yearFromDateOnly(cycleStart);
    if (!Number.isFinite(y)) return false;

    const sameYearAuto = list
      .filter(
        (p) =>
          p.is_auto_generated === true &&
          p.auto_cycle_start_date != null &&
          p.auto_cycle_start_date !== '' &&
          yearFromDateOnly(p.auto_cycle_start_date) === y
      )
      .sort((a, b) => (a.auto_cycle_start_date ?? '').localeCompare(b.auto_cycle_start_date ?? ''));

    const idx = sameYearAuto.findIndex((p) => p.id === period.id);
    if (idx < 0) return false;
    return idx + 1 >= 2;
  }

  return legacySemesterTwo(period);
}
