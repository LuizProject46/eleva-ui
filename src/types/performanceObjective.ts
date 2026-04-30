export interface PerformanceObjectiveRow {
  id: string;
  tenant_id: string;
  employee_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  /** Integer percent (1–100) for this objective; all rows for the same employee sum to 100. */
  item_weight: number;
  rating: number | null;
  manager_comment: string | null;
  rated_by: string | null;
  rated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceObjectiveInsertInput {
  employee_id: string;
  title: string;
  description?: string | null;
  sort_order?: number;
  /** Integer percent 1–100; with existing objectives, new total must equal 100%. */
  item_weight?: number;
}

export interface PerformanceObjectiveUpdateInput {
  title?: string;
  description?: string | null;
  sort_order?: number;
  /** Integer percent 1–100; all objectives for the employee must still sum to 100%. */
  item_weight?: number;
  rating?: number | null;
  manager_comment?: string | null;
}
