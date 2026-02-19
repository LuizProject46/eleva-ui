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
  workload_hours: number | null;
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

/** Certificate (immutable; one per completed assignment). */
export interface Certificate {
  id: string;
  assignment_id: string;
  user_id: string;
  course_id: string;
  tenant_id: string;
  certificate_code: string;
  user_name: string;
  course_name: string;
  workload_hours: number | null;
  completion_date: string;
  created_at: string;
}

/** Tenant branding for certificate PDF (whitelabel). */
export interface CertificateBranding {
  companyName: string;
  logoDataUrl?: string;
  primaryColorHex: string;
  accentColorHex: string;
}

/** Payload for certificate PDF generation. */
export interface CertificatePdfPayload {
  userName: string;
  courseName: string;
  workloadHours: number | null;
  certificateCode: string;
  completionDate: string;
  validationUrl: string;
  qrDataUrl: string;
  /** Whitelabel: tenant logo, colors, company name (signature). */
  branding?: CertificateBranding;
}

/** Row from get_my_certificates (paginated list). */
export interface MyCertificateRow {
  id: string;
  assignment_id: string;
  course_name: string;
  completion_date: string;
  certificate_code: string;
  total_count: number;
}

/** Row from get_certificate_for_verification (public by code). */
export interface CertificateVerificationRow {
  user_name: string;
  course_name: string;
  completion_date: string;
  certificate_code: string;
}

/** Approval status for completed course (based on questionnaire passing_score). */
export type ApprovalStatus = 'approved' | 'failed';

/** Row from get_course_assignments_admin_progress (HR progress grid with pagination). */
export interface CourseAssignmentProgressRow {
  assignment_id: string;
  course_id: string;
  course_title: string;
  user_id: string;
  user_name: string;
  user_department: string | null;
  user_position: string | null;
  status: CourseAssignmentStatus;
  completed_at: string | null;
  progress_pct: number;
  total_steps: number;
  completed_steps: number;
  certificate_id: string | null;
  /** Course questionnaire passing score (percentage). */
  passing_score: number | null;
  /** Approved when score >= passing_score; failed otherwise; null when not completed. */
  approval_status: ApprovalStatus | null;
  /** Correct answers in latest attempt. */
  score_correct: number | null;
  /** Total questions in latest attempt. */
  score_total: number | null;
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
  workload_hours?: number | null;
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
