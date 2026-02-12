import { describe, it, expect } from 'vitest';
import { getPeriodStatus, type PeriodicityConfigForCheck } from '@/lib/periodicity';

function atLocalMidnight(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split('-').map((x) => parseInt(x, 10));
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

describe('periodicity windows [start,end)', () => {
  it('daily window does not overlap at boundary', () => {
    const config: PeriodicityConfigForCheck = {
      reference_start_date: '2025-02-01',
      interval_kind: 'custom',
      custom_interval_days: 1,
      custom_interval_months: null,
    };

    const now = atLocalMidnight('2026-02-12');
    const result = getPeriodStatus(config, now);

    expect(result.status).toBe('within');
    expect(result.currentPeriod?.periodStart).toBe('2026-02-12');
    expect(result.currentPeriod?.periodEnd).toBe('2026-02-13');
    expect(result.nextPeriodStart).toBe('2026-02-13');

    const prevInstant = new Date(result.currentPeriod!.periodStartAt.getTime() - 1);
    const prevResult = getPeriodStatus(config, prevInstant);
    expect(prevResult.currentPeriod?.periodStart).toBe('2026-02-11');
    expect(prevResult.currentPeriod?.periodEnd).toBe('2026-02-12');
    expect(prevResult.currentPeriod!.periodEndAt.getTime()).toBe(result.currentPeriod!.periodStartAt.getTime());
  });

  it('last instant of a period is strictly < periodEndAt', () => {
    const config: PeriodicityConfigForCheck = {
      reference_start_date: '2025-02-01',
      interval_kind: 'custom',
      custom_interval_days: 1,
      custom_interval_months: null,
    };

    const inPeriod = atLocalMidnight('2026-02-11');
    const result = getPeriodStatus(config, inPeriod);
    expect(result.status).toBe('within');
    expect(result.currentPeriod).not.toBeNull();

    const endAt = result.currentPeriod!.periodEndAt;
    const lastInstant = new Date(endAt.getTime() - 1);

    const lastInstantResult = getPeriodStatus(config, lastInstant);
    expect(lastInstantResult.currentPeriod?.periodStart).toBe('2026-02-11');
    expect(lastInstant.getTime()).toBeLessThan(endAt.getTime());

    const boundaryResult = getPeriodStatus(config, endAt);
    expect(boundaryResult.currentPeriod?.periodStart).toBe('2026-02-12');
  });

  it('duplicate-prevention predicate matches [start,end) semantics', () => {
    const config: PeriodicityConfigForCheck = {
      reference_start_date: '2025-02-01',
      interval_kind: 'custom',
      custom_interval_days: 1,
      custom_interval_months: null,
    };

    const now = atLocalMidnight('2026-02-11');
    const { currentPeriod } = getPeriodStatus(config, now);
    expect(currentPeriod).not.toBeNull();

    const startAt = currentPeriod!.periodStartAt;
    const endAt = currentPeriod!.periodEndAt;

    const completedInside = new Date(startAt.getTime() + 60_000);
    const completedAtEnd = new Date(endAt.getTime());

    const isBlocked = (completedAt: Date) =>
      completedAt.getTime() >= startAt.getTime() && completedAt.getTime() < endAt.getTime();

    expect(isBlocked(completedInside)).toBe(true);
    expect(isBlocked(completedAtEnd)).toBe(false);
  });
});

