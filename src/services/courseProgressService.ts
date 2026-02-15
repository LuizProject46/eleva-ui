/**
 * Course roadmap progress: record step completion (sequential), fetch progress.
 * Sequential rule: step N can be completed only when step N-1 is completed for that assignment.
 */

import { supabase } from '@/lib/supabase';
import type { CourseRoadmapItemProgress } from '@/types/courses';

export async function listProgressByAssignment(assignmentId: string): Promise<CourseRoadmapItemProgress[]> {
  const { data, error } = await supabase
    .from('course_roadmap_item_progress')
    .select('*')
    .eq('assignment_id', assignmentId);

  if (error) throw error;
  return (data ?? []) as CourseRoadmapItemProgress[];
}

export async function getCompletedRoadmapItemIds(assignmentId: string): Promise<Set<string>> {
  const rows = await listProgressByAssignment(assignmentId);
  return new Set(rows.map((r) => r.roadmap_item_id));
}

/**
 * Returns whether the previous step (by position) is completed for this assignment.
 * Call this before allowing completion of the next step.
 */
export async function canCompleteStep(
  assignmentId: string,
  roadmapItemId: string,
  previousRoadmapItemId: string | null
): Promise<boolean> {
  if (!previousRoadmapItemId) return true;

  const { data, error } = await supabase
    .from('course_roadmap_item_progress')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('roadmap_item_id', previousRoadmapItemId)
    .maybeSingle();

  if (error) throw error;
  return data != null;
}

/**
 * Record completion of a roadmap item. Caller should ensure previous step is completed.
 */
export async function completeRoadmapItem(
  assignmentId: string,
  roadmapItemId: string
): Promise<CourseRoadmapItemProgress> {
  const { data, error } = await supabase
    .from('course_roadmap_item_progress')
    .upsert(
      {
        assignment_id: assignmentId,
        roadmap_item_id: roadmapItemId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'assignment_id,roadmap_item_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as CourseRoadmapItemProgress;
}

/** Check if course is completed (all roadmap steps + passed questionnaire). Uses DB function. */
export async function isCourseCompleted(assignmentId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('course_is_completed', {
    p_assignment_id: assignmentId,
  });

  if (error) throw error;
  return Boolean(data);
}
