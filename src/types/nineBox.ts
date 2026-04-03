import type { TenantEvaluationPeriod } from '@/types/evaluationPeriod';

export type NineBoxAxisLevel = 'low' | 'medium' | 'high';
export type NineBoxDataMode = 'legacy' | 'competency';
export type NineBoxSnapshotStatus = 'complete' | 'incomplete';

export interface NineBoxProfileSnippet {
  id: string;
  name: string;
  department: string | null;
  avatar_url: string | null;
  avatar_thumb_url: string | null;
}

/** Row returned from list query with embedded profile */
export interface NineBoxMatrixRow {
  id: string;
  employee_id: string;
  performance: NineBoxAxisLevel;
  potential: NineBoxAxisLevel;
  notes: string | null;
  evaluated_by: string;
  updated_at: string;
  profiles: NineBoxProfileSnippet | null;
  source_mode?: NineBoxDataMode;
  period_id?: string | null;
  performance_score?: number | null;
  potential_score?: number | null;
  position?: string | null;
  snapshot_status?: NineBoxSnapshotStatus;
  missing_competencies?: string[];
}

export interface NineBoxEvaluationSummary {
  id: string;
  employee_id: string;
  performance: NineBoxAxisLevel;
  potential: NineBoxAxisLevel;
  updated_at: string;
}

export interface NineBoxUpsertPayload {
  tenantId: string;
  employeeId: string;
  performance: NineBoxAxisLevel;
  potential: NineBoxAxisLevel;
  notes: string | null;
  evaluatedBy: string;
}

/** Evaluation period row as used by 9-box (includes `starts_at` for competency-semester rules). */
export type NineBoxEvaluationPeriod = TenantEvaluationPeriod;

export interface NineBoxMatrixDataResponse {
  mode: NineBoxDataMode;
  period: NineBoxEvaluationPeriod | null;
  rows: NineBoxMatrixRow[];
}
