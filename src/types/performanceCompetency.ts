export interface EvaluationCompetencyRow {
  id: string;
  name: string;
  description: string;
  order: number;
}

export interface PerformanceCompetencyAssignmentRow {
  id: string;
  tenant_id: string;
  employee_id: string;
  competency_id: string;
  /** Decimal 0-1 stored in database (displayed as percentage in UI). */
  item_weight: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceCompetencyAssignmentInsertInput {
  employee_id: string;
  competency_id: string;
  /** Decimal 0-1 */
  item_weight: number;
}

export interface PerformanceCompetencyAssignmentUpdateInput {
  /** Decimal 0-1 */
  item_weight?: number;
}

export interface PerformanceCompetencyEvaluationRow {
  id: string;
  tenant_id: string;
  employee_id: string;
  competency_id: string;
  rating: number | null;
  manager_comment: string | null;
  rated_by: string | null;
  rated_at: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceCompetencyEvaluationUpsertInput {
  employee_id: string;
  competency_id: string;
  rating: number | null;
  manager_comment?: string | null;
}
