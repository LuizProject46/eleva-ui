import type { TenantEvaluationPeriod } from '@/types/evaluationPeriod';

export function uniqueYearsDescending(periods: Pick<TenantEvaluationPeriod, 'year'>[]): number[] {
  const set = new Set<number>();
  for (const p of periods) {
    if (Number.isFinite(p.year)) set.add(p.year);
  }
  return Array.from(set).sort((a, b) => b - a);
}

export function filterPeriodsByYear<T extends Pick<TenantEvaluationPeriod, 'year'>>(
  periods: T[],
  year: number
): T[] {
  return periods.filter((p) => p.year === year);
}

export function sortPeriodsByStartsAt<T extends { starts_at: string | null; id: string }>(
  periods: T[],
  direction: 'asc' | 'desc'
): T[] {
  const mul = direction === 'asc' ? 1 : -1;
  return [...periods].sort((a, b) => {
    const ta = a.starts_at ? Date.parse(a.starts_at) : 0;
    const tb = b.starts_at ? Date.parse(b.starts_at) : 0;
    const na = Number.isFinite(ta) ? ta : 0;
    const nb = Number.isFinite(tb) ? tb : 0;
    if (na !== nb) return (na - nb) * mul;
    return a.id.localeCompare(b.id);
  });
}
