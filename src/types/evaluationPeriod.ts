export interface TenantEvaluationPeriod {
  id: string;
  name: string;
  year: number;
  semester: number | null;
  starts_at: string | null;
  is_auto_generated?: boolean | null;
  auto_cycle_start_date?: string | null;
}
