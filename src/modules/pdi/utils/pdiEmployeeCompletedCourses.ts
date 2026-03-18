import { supabase } from '@/lib/supabase';
import { listAssignmentsByUser } from '@/services/courseAssignmentService';
import { isCourseCompleted } from '@/services/courseProgressService';

const MAX_ASSIGNMENTS_TO_CHECK = 15;

/**
 * Course titles the employee completed (same source as PdiContextSection), for PDF/context.
 */
export async function getCompletedCourseTitlesForPdiContext(
  employeeId: string
): Promise<string[]> {
  if (!employeeId) return [];
  try {
    const assignments = await listAssignmentsByUser(employeeId);
    const toCheck = assignments.slice(0, MAX_ASSIGNMENTS_TO_CHECK);
    const completed = await Promise.all(
      toCheck.map(async (a) => {
        const ok = await isCourseCompleted(a.id);
        return ok ? a.course_id : null;
      })
    );
    const completedCourseIds = completed.filter((id): id is string => id != null);
    if (completedCourseIds.length === 0) return [];
    const { data: courses } = await supabase
      .from('courses')
      .select('id, title')
      .in('id', completedCourseIds);
    return (courses ?? []).map((c) => c.title ?? '').filter(Boolean);
  } catch {
    return [];
  }
}
