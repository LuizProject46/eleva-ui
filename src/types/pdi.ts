/**
 * Types for PDI (Plano de Desenvolvimento Individual) module.
 */

export type PdiStatus = 'draft' | 'active' | 'closed' | 'archived';
export type PdiType =
  | 'technical_skill'
  | 'behavioral'
  | 'leadership'
  | 'career_growth'
  | 'performance_improvement';
export type PdiCloseResult = 'completed' | 'partial' | 'not_completed';

export interface Pdi {
  id: string;
  tenant_id: string;
  employee_id: string;
  type: PdiType;
  title: string | null;
  status: PdiStatus;
  closed_at: string | null;
  result: PdiCloseResult | null;
  close_comment: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PdiProgress {
  total_actions: number;
  completed_actions: number;
  progress_pct: number;
}

// Action Plan (replaces competency/gap model)
export interface PdiActionPlan {
  id: string;
  pdi_id: string;
  type: string;
  delivery_date: string;
  description: string;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  reminder_sent_at?: string | null;
}

export interface PdiActionPlanInsert {
  pdi_id: string;
  type: string;
  delivery_date: string;
  description: string;
  position?: number;
  created_by: string;
}

export interface PdiActionPlanUpdate {
  type?: string;
  delivery_date?: string;
  description?: string;
  position?: number;
}

// Plan action (checklist task within an action plan)
export interface PdiPlanAction {
  id: string;
  pdi_action_plan_id: string;
  description: string;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface PdiPlanActionInsert {
  pdi_action_plan_id: string;
  description: string;
  completed?: boolean;
  position?: number;
}

export interface PdiPlanActionUpdate {
  description?: string;
  completed?: boolean;
  position?: number;
}

export interface PdiInsert {
  tenant_id: string;
  employee_id: string;
  type: PdiType;
  title?: string | null;
  created_by?: string | null;
}

export interface PdiWithRelations extends Pdi {
  employee?: { id: string; name: string; email: string } | null;
  actionPlans?: PdiActionPlan[];
  progress?: PdiProgress | null;
}
