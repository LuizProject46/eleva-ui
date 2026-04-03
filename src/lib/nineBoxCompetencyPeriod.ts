/**
 * When competency-based 9-box applies for a period.
 * Must stay aligned with public.generate_competency_nine_box_snapshot (effective semester).
 */
export function isEvaluationPeriodCompetencyNineBox(period: {
  semester: number | null;
  starts_at?: string | null;
}): boolean {
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
