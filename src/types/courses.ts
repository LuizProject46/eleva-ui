/**
 * Types for Courses / Trainings module (mirror Supabase schema).
 */

export type CourseType = 'mandatory' | 'optional';
export type CourseSource = 'imported_pdf' | 'ai_created' | 'manual';
export type RoadmapContentType = 'video' | 'pdf' | 'audio' | 'external_link';
export type QuestionnaireQuestionType = 'single_choice' | 'multiple_choice';
export type CourseAssignmentStatus = 'not_started' | 'in_progress' | 'completed';

export interface Course {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  type: CourseType;
  source: CourseSource;
  cover_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CourseRoadmapItem {
  id: string;
  course_id: string;
  position: number;
  content_type: RoadmapContentType;
  title: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CourseAssignment {
  id: string;
  course_id: string;
  user_id: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface CourseRoadmapItemProgress {
  id: string;
  assignment_id: string;
  roadmap_item_id: string;
  completed_at: string;
}

export interface CourseQuestionnaire {
  id: string;
  course_id: string;
  title: string;
  passing_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireQuestion {
  id: string;
  questionnaire_id: string;
  position: number;
  question_text: string;
  question_type: QuestionnaireQuestionType;
  options: string[];
  correct_answer: unknown;
  created_at: string;
  updated_at: string;
}

/** Question shape returned for test-taking (no correct_answer). Use with get_questionnaire_questions_for_attempt. */
export interface QuestionnaireQuestionForAttempt {
  id: string;
  position: number;
  question_text: string;
  question_type: QuestionnaireQuestionType;
  options: string[];
}

export interface CourseQuestionnaireAttempt {
  id: string;
  assignment_id: string;
  questionnaire_id: string;
  score: number;
  passed: boolean;
  answers: Record<string, unknown>;
  submitted_at: string;
}

/** Payload for PDF roadmap item */
export interface RoadmapItemPdfPayload {
  storage_path: string;
}

/** Payload for video roadmap item (session with multiple videos) */
export interface RoadmapItemVideoPayload {
  session_index?: number;
  videos: Array<{ url?: string; storage_path?: string; title: string }>;
}

/** Admin list row from get_course_assignments_admin_list */
export interface CourseAssignmentAdminRow {
  assignment_id: string;
  course_id: string;
  course_title: string;
  user_id: string;
  user_name: string;
  user_department: string | null;
  status: CourseAssignmentStatus;
  completed_at: string | null;
}

/** Row from get_course_assignments_admin_progress (HR progress grid with pagination). */
export interface CourseAssignmentProgressRow {
  assignment_id: string;
  course_id: string;
  course_title: string;
  user_id: string;
  user_name: string;
  user_department: string | null;
  status: CourseAssignmentStatus;
  completed_at: string | null;
  progress_pct: number;
  total_steps: number;
  completed_steps: number;
  total_count: number;
}

/** Row from get_my_course_assignments_with_progress (employee listing with progress). */
export interface MyAssignmentWithProgressRow {
  assignment_id: string;
  course_id: string;
  assigned_at: string;
  course_title: string;
  course_description: string | null;
  course_type: CourseType;
  course_cover_url: string | null;
  course_tenant_id: string;
  total_steps: number;
  completed_steps: number;
  quiz_passed: boolean;
  status: CourseAssignmentStatus;
  progress_pct: number;
  total_count: number;
}

/** Insert shapes (omit id, timestamps where defaulted) */
export interface CourseInsert {
  tenant_id: string;
  title: string;
  description?: string | null;
  type?: CourseType;
  source?: CourseSource;
  cover_url?: string | null;
  created_by?: string | null;
}

export interface CourseRoadmapItemInsert {
  course_id: string;
  position: number;
  content_type: RoadmapContentType;
  title: string;
  payload?: Record<string, unknown>;
}

export interface CourseAssignmentInsert {
  course_id: string;
  user_id: string;
  assigned_by?: string | null;
}

export interface CourseQuestionnaireInsert {
  course_id: string;
  title: string;
  passing_score?: number | null;
}

export interface QuestionnaireQuestionInsert {
  questionnaire_id: string;
  position: number;
  question_text: string;
  question_type: QuestionnaireQuestionType;
  options: string[];
  correct_answer: unknown;
}
