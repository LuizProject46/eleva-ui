/**
 * Course questionnaire: submit attempt (score computed by backend only), list attempts.
 * Frontend never receives correct answers; validation is server-side only.
 */

import { supabase } from '@/lib/supabase';

export interface SubmitAttemptPayload {
  assignmentId: string;
  questionnaireId: string;
  answers: Record<string, string | string[]>;
}

/**
 * Submits a questionnaire attempt. Score and pass/fail are computed by the backend;
 * the frontend only sends the selected answers. No correct answers are exposed.
 */
export async function submitAttempt(payload: SubmitAttemptPayload): Promise<{ score: number; passed: boolean }> {
  const { data, error } = await supabase.rpc('submit_questionnaire_attempt', {
    p_assignment_id: payload.assignmentId,
    p_questionnaire_id: payload.questionnaireId,
    p_answers: payload.answers as unknown as Record<string, unknown>,
  });

  if (error) throw error;

  const result = data as { score: number; passed: boolean } | null;
  if (!result || typeof result.score !== 'number' || typeof result.passed !== 'boolean') {
    throw new Error('Invalid response from server');
  }
  return result;
}

export async function listAttempts(assignmentId: string) {
  const { data, error } = await supabase
    .from('course_questionnaire_attempts')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getLatestPassedAttempt(assignmentId: string) {
  const { data, error } = await supabase
    .from('course_questionnaire_attempts')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('passed', true)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
