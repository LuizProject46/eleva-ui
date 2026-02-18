/**
 * Course CRUD and roadmap items. Supabase + RLS; no REST layer.
 */

import { supabase } from '@/lib/supabase';
import type {
  Course,
  CourseInsert,
  CourseRoadmapItem,
  CourseRoadmapItemInsert,
  CourseQuestionnaire,
  CourseQuestionnaireInsert,
  QuestionnaireQuestion,
  QuestionnaireQuestionForAttempt,
  QuestionnaireQuestionInsert,
} from '@/types/courses';

const COURSES_BUCKET = 'course-content';

const MAX_COURSE_COVER_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_COURSE_PDF_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_COURSE_VIDEO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_COURSE_FILE_SIZE_BYTES = Math.max(
  MAX_COURSE_COVER_SIZE_BYTES,
  MAX_COURSE_PDF_SIZE_BYTES,
  MAX_COURSE_VIDEO_SIZE_BYTES
);
const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

/** Validates course cover image (type + 2MB). Returns error message or null. */
export function validateCourseCoverFile(file: File): string | null {
  if (!ALLOWED_COVER_TYPES.includes(file.type)) {
    return 'Formato inválido. Use JPG, PNG ou WebP.';
  }
  if (file.size > MAX_COURSE_COVER_SIZE_BYTES) {
    return 'Arquivo muito grande. Máximo 2MB.';
  }
  return null;
}

/** Validates course PDF (type + 5MB). Returns error message or null. */
export function validateCoursePdfFile(file: File): string | null {
  if (file.type !== 'application/pdf') {
    return 'Formato inválido. Use PDF.';
  }
  if (file.size > MAX_COURSE_PDF_SIZE_BYTES) {
    return 'Arquivo muito grande. Máximo 5MB.';
  }
  return null;
}

/** Validates course video (type + 5MB). Returns error message or null. */
export function validateCourseVideoFile(file: File): string | null {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return 'Formato inválido. Use MP4, WebM ou MOV.';
  }
  if (file.size > MAX_COURSE_VIDEO_SIZE_BYTES) {
    return 'Arquivo muito grande. Máximo 5MB.';
  }
  return null;
}

/** Escape % and _ for safe use in ILIKE patterns (no injection). */
function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export interface ListCoursesOptions {
  search?: string;
  type?: 'mandatory' | 'optional';
  limit?: number;
  offset?: number;
}

export interface ListCoursesResult {
  data: Course[];
  total: number;
}

export async function listCourses(
  tenantId: string,
  options: ListCoursesOptions = {}
): Promise<ListCoursesResult> {
  const { search, type, limit = 1000, offset = 0 } = options;

  let query = supabase
    .from('courses')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (search && search.trim()) {
    const sanitized = escapeIlikePattern(search.trim());
    const pattern = `%${sanitized}%`;
    query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
  }

  if (type) {
    query = query.eq('type', type);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;
  return {
    data: (data ?? []) as Course[],
    total: count ?? 0,
  };
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data as Course | null;
}

export async function createCourse(
  payload: CourseInsert
): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .insert({
      tenant_id: payload.tenant_id,
      title: payload.title,
      description: payload.description ?? null,
      type: payload.type ?? 'optional',
      source: payload.source ?? 'manual',
      cover_url: payload.cover_url ?? null,
      workload_hours: payload.workload_hours ?? null,
      created_by: payload.created_by ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Course;
}

export async function updateCourse(
  courseId: string,
  updates: Partial<Pick<Course, 'title' | 'description' | 'type' | 'cover_url' | 'workload_hours'>>
): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('id', courseId)
    .select()
    .single();

  if (error) throw error;
  return data as Course;
}

/** Soft delete: set deleted_at */
export async function softDeleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', courseId);

  if (error) throw error;
}

// ——— Roadmap items ———

export async function listRoadmapItems(courseId: string): Promise<CourseRoadmapItem[]> {
  const { data, error } = await supabase
    .from('course_roadmap_items')
    .select('*')
    .eq('course_id', courseId)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CourseRoadmapItem[];
}

export async function createRoadmapItem(
  payload: CourseRoadmapItemInsert
): Promise<CourseRoadmapItem> {
  const { data, error } = await supabase
    .from('course_roadmap_items')
    .insert({
      course_id: payload.course_id,
      position: payload.position,
      content_type: payload.content_type,
      title: payload.title,
      payload: payload.payload ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as CourseRoadmapItem;
}

export async function updateRoadmapItem(
  itemId: string,
  updates: Partial<Pick<CourseRoadmapItem, 'position' | 'title' | 'payload'>>
): Promise<CourseRoadmapItem> {
  const { data, error } = await supabase
    .from('course_roadmap_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data as CourseRoadmapItem;
}

export async function deleteRoadmapItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('course_roadmap_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
}

export async function reorderRoadmapItems(
  courseId: string,
  orderedIds: string[]
): Promise<void> {
  const updates = orderedIds.map((id, index) =>
    supabase.from('course_roadmap_items').update({ position: index }).eq('id', id).eq('course_id', courseId)
  );
  await Promise.all(updates);
}

// ——— Questionnaires (one per course) ———

export async function getQuestionnaireByCourseId(courseId: string): Promise<CourseQuestionnaire | null> {
  const { data, error } = await supabase
    .from('course_questionnaires')
    .select('*')
    .eq('course_id', courseId)
    .maybeSingle();

  if (error) throw error;
  return data as CourseQuestionnaire | null;
}

export async function createQuestionnaire(
  payload: CourseQuestionnaireInsert
): Promise<CourseQuestionnaire> {
  const { data, error } = await supabase
    .from('course_questionnaires')
    .insert({
      course_id: payload.course_id,
      title: payload.title,
      passing_score: payload.passing_score ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CourseQuestionnaire;
}

export async function updateQuestionnaire(
  questionnaireId: string,
  updates: Partial<Pick<CourseQuestionnaire, 'title' | 'passing_score'>>
): Promise<CourseQuestionnaire> {
  const { data, error } = await supabase
    .from('course_questionnaires')
    .update(updates)
    .eq('id', questionnaireId)
    .select()
    .single();

  if (error) throw error;
  return data as CourseQuestionnaire;
}

// ——— Questionnaire questions ———

export async function listQuestionnaireQuestions(questionnaireId: string): Promise<QuestionnaireQuestion[]> {
  const { data, error } = await supabase
    .from('questionnaire_questions')
    .select('*')
    .eq('questionnaire_id', questionnaireId)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data ?? []) as QuestionnaireQuestion[];
}

/** Questions for test-taking only (no correct_answer). Validates assignment server-side. */
export async function listQuestionnaireQuestionsForAttempt(
  questionnaireId: string
): Promise<QuestionnaireQuestionForAttempt[]> {
  const { data, error } = await supabase.rpc('get_questionnaire_questions_for_attempt', {
    p_questionnaire_id: questionnaireId,
  });
  if (error) throw error;
  return (data ?? []) as QuestionnaireQuestionForAttempt[];
}

export async function createQuestionnaireQuestion(
  payload: QuestionnaireQuestionInsert
): Promise<QuestionnaireQuestion> {
  const { data, error } = await supabase
    .from('questionnaire_questions')
    .insert({
      questionnaire_id: payload.questionnaire_id,
      position: payload.position,
      question_text: payload.question_text,
      question_type: payload.question_type,
      options: payload.options,
      correct_answer: payload.correct_answer,
    })
    .select()
    .single();

  if (error) throw error;
  return data as QuestionnaireQuestion;
}

export async function updateQuestionnaireQuestion(
  questionId: string,
  updates: Partial<Pick<QuestionnaireQuestion, 'position' | 'question_text' | 'question_type' | 'options' | 'correct_answer'>>
): Promise<QuestionnaireQuestion> {
  const { data, error } = await supabase
    .from('questionnaire_questions')
    .update(updates)
    .eq('id', questionId)
    .select()
    .single();

  if (error) throw error;
  return data as QuestionnaireQuestion;
}

export async function deleteQuestionnaireQuestion(questionId: string): Promise<void> {
  const { error } = await supabase
    .from('questionnaire_questions')
    .delete()
    .eq('id', questionId);

  if (error) throw error;
}

// ——— Storage: signed URL for private bucket ———

export function getCourseContentBucket(): string {
  return COURSES_BUCKET;
}

export async function getSignedUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(COURSES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Failed to create signed URL');
  return data.signedUrl;
}

export async function uploadCourseFile(
  tenantId: string,
  courseId: string,
  pathSuffix: string,
  file: File
): Promise<{ path: string }> {
  if (file.size > MAX_COURSE_FILE_SIZE_BYTES) {
    throw new Error('Arquivo muito grande. Máximo 5MB.');
  }
  const path = `${tenantId}/courses/${courseId}/${pathSuffix}`;
  const { error } = await supabase.storage.from(COURSES_BUCKET).upload(path, file, {
    upsert: true,
  });
  if (error) throw error;
  return { path };
}

/** Upload course cover/thumbnail; returns storage path. Store path in courses.cover_url. */
export async function uploadCourseCover(
  tenantId: string,
  courseId: string,
  file: File
): Promise<{ path: string }> {
  const err = validateCourseCoverFile(file);
  if (err) throw new Error(err);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
  const pathSuffix = `cover.${ext}`;
  return uploadCourseFile(tenantId, courseId, pathSuffix, file);
}
