/**
 * Course assignments: assign/unassign users, list by course or by user.
 * Uses Supabase + RLS; admin list via get_course_assignments_admin_list.
 */

import { supabase } from '@/lib/supabase';
import type {
  CourseAssignment,
  CourseAssignmentInsert,
  CourseAssignmentAdminRow,
  CourseAssignmentProgressRow,
  MyAssignmentWithProgressRow,
} from '@/types/courses';

export interface ListMyAssignmentsWithProgressOptions {
  search?: string;
  status?: 'completed' | 'in_progress' | 'not_started';
  limit?: number;
  offset?: number;
}

export interface ListMyAssignmentsWithProgressResult {
  data: MyAssignmentWithProgressRow[];
  total: number;
}

export async function listAssignmentsByCourse(courseId: string): Promise<CourseAssignment[]> {
  const { data, error } = await supabase
    .from('course_assignments')
    .select('*')
    .eq('course_id', courseId)
    .order('assigned_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as CourseAssignment[];
}

export async function listAssignmentsByUser(userId: string): Promise<CourseAssignment[]> {
  const { data, error } = await supabase
    .from('course_assignments')
    .select('*')
    .eq('user_id', userId)
    .order('assigned_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as CourseAssignment[];
}

export async function getAssignment(assignmentId: string): Promise<CourseAssignment | null> {
  const { data, error } = await supabase
    .from('course_assignments')
    .select('*')
    .eq('id', assignmentId)
    .maybeSingle();

  if (error) throw error;
  return data as CourseAssignment | null;
}

export async function getAssignmentByCourseAndUser(
  courseId: string,
  userId: string
): Promise<CourseAssignment | null> {
  const { data, error } = await supabase
    .from('course_assignments')
    .select('*')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as CourseAssignment | null;
}

export async function createAssignment(
  payload: CourseAssignmentInsert
): Promise<CourseAssignment> {
  const { data, error } = await supabase
    .from('course_assignments')
    .insert({
      course_id: payload.course_id,
      user_id: payload.user_id,
      assigned_by: payload.assigned_by ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CourseAssignment;
}

export async function assignCourseToUsers(
  courseId: string,
  userIds: string[],
  assignedBy: string
): Promise<CourseAssignment[]> {
  const results: CourseAssignment[] = [];
  for (const userId of userIds) {
    const { data, error } = await supabase
      .from('course_assignments')
      .insert({
        course_id: courseId,
        user_id: userId,
        assigned_by: assignedBy,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') continue;
      throw error;
    }
    results.push(data as CourseAssignment);
  }
  return results;
}

export async function unassignCourse(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from('course_assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) throw error;
}

/** Admin list: one row per assignment with status (not_started, in_progress, completed). */
export async function getCourseAssignmentsAdminList(
  filters?: { courseId?: string; userId?: string }
): Promise<CourseAssignmentAdminRow[]> {
  const { data, error } = await supabase.rpc('get_course_assignments_admin_list', {
    p_course_id: filters?.courseId ?? null,
    p_user_id: filters?.userId ?? null,
  });

  if (error) throw error;
  return (data ?? []) as CourseAssignmentAdminRow[];
}

export interface ListAdminProgressOptions {
  search?: string;
  status?: string;
  courseId?: string | null;
  limit?: number;
  offset?: number;
}

export interface ListAdminProgressResult {
  data: CourseAssignmentProgressRow[];
  total: number;
}

/** HR/Manager: assignment progress list with search, filters and pagination. */
export async function listCourseAssignmentsAdminProgress(
  options: ListAdminProgressOptions = {}
): Promise<ListAdminProgressResult> {
  const { search, status, courseId, limit = 20, offset = 0 } = options;
  const { data, error } = await supabase.rpc('get_course_assignments_admin_progress', {
    p_search: search && search.trim() ? search.trim() : null,
    p_status: status && status.trim() ? status.trim() : null,
    p_course_id: courseId ?? null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  const rows = (data ?? []) as CourseAssignmentProgressRow[];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return { data: rows, total };
}

/** Employee "my courses" listing: single RPC with progress and status. No N+1. */
export async function listMyAssignmentsWithProgress(
  userId: string,
  options: ListMyAssignmentsWithProgressOptions = {}
): Promise<ListMyAssignmentsWithProgressResult> {
  const { search, status, limit = 100, offset = 0 } = options;

  const { data, error } = await supabase.rpc('get_my_course_assignments_with_progress', {
    p_user_id: userId,
    p_search: search && search.trim() ? search.trim() : null,
    p_status: status ?? null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  const rows = (data ?? []) as MyAssignmentWithProgressRow[];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return { data: rows, total };
}
