/**
 * Types for PDI (Plano de Desenvolvimento Individual) module.
 */

export type PdiStatus = 'draft' | 'in_approval' | 'active' | 'closed' | 'archived';
export type PdiOrigin = 'evaluation' | 'disc' | 'feedback';
export type PdiCloseResult = 'completed' | 'partial' | 'not_completed';
export type PdiPriority = 'high' | 'medium' | 'low';
export type PdiActionType = 'course' | 'practice';
export type PdiActionStatus = 'pending' | 'in_progress' | 'completed';
export type PdiCheckinOverallStatus = 'not_started' | 'in_progress' | 'completed';
export type PdiObjectiveStatus = 'not_started' | 'in_progress' | 'completed';

export interface Pdi {
  id: string;
  tenant_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  origin: PdiOrigin;
  evaluation_id: string | null;
  behavioral_assessment_id: string | null;
  status: PdiStatus;
  closed_at: string | null;
  result: PdiCloseResult | null;
  close_comment: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PdiObjective {
  id: string;
  pdi_id: string;
  description: string;
  competency: string | null;
  priority: PdiPriority | null;
  due_date: string | null;
  position: number;
}

/** Goal progress and status are computed from action plans (get_pdi_goal_progress). */
export interface PdiGoalProgress {
  objective_id: string;
  progress_pct: number;
  status: PdiObjectiveStatus;
}

export interface PdiAction {
  id: string;
  pdi_objective_id: string;
  description: string;
  type: PdiActionType;
  responsible_user_id: string;
  due_date: string | null;
  status: PdiActionStatus;
  progress_pct: number;
  course_assignment_id: string | null;
  completion_criteria: string | null;
  created_at: string;
  updated_at: string;
}

/** Action progress from get_pdi_action_progress (course = live from course, practice = stored). */
export interface PdiActionProgress {
  action_id: string;
  progress_pct: number;
  status: PdiActionStatus;
  is_from_course: boolean;
}

export interface PdiCheckin {
  id: string;
  pdi_id: string;
  checkin_date: string;
  overall_status: PdiCheckinOverallStatus;
  manager_comment: string | null;
  employee_comment: string | null;
  author_id: string;
  created_at: string;
}

export interface PdiProgress {
  total_actions: number;
  completed_actions: number;
  progress_pct: number;
}

export interface PdiInsert {
  tenant_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  origin: PdiOrigin;
  evaluation_id?: string | null;
  behavioral_assessment_id?: string | null;
  created_by?: string | null;
}

export interface PdiObjectiveInsert {
  pdi_id: string;
  description: string;
  competency?: string | null;
  priority?: PdiPriority | null;
  due_date?: string | null;
  position?: number;
}

export interface PdiActionInsert {
  pdi_objective_id: string;
  description: string;
  type: PdiActionType;
  responsible_user_id: string;
  due_date?: string | null;
  course_assignment_id?: string | null;
  completion_criteria?: string | null;
}

export interface PdiCheckinInsert {
  pdi_id: string;
  checkin_date: string;
  overall_status: PdiCheckinOverallStatus;
  manager_comment: string | null;
  employee_comment?: string | null;
  author_id: string;
}

export interface PdiCheckinUpdate {
  checkin_date?: string;
  overall_status?: PdiCheckinOverallStatus;
  manager_comment?: string | null;
  employee_comment?: string | null;
}

export interface PdiWithRelations extends Pdi {
  employee?: { id: string; name: string; email: string } | null;
  objectives?: (PdiObjective & { actions?: PdiAction[]; goalProgress?: PdiGoalProgress })[];
  progress?: PdiProgress | null;
}
