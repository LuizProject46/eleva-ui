/**
 * Certificate service: fetch, list, generate if eligible, public verification.
 */

import { supabase } from '@/lib/supabase';
import type {
  Certificate,
  MyCertificateRow,
  CertificateVerificationRow,
} from '@/types/courses';

export async function getCertificateById(certificateId: string): Promise<Certificate | null> {
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('id', certificateId)
    .maybeSingle();

  if (error) throw error;
  return data as Certificate | null;
}

export async function getCertificateByAssignmentId(
  assignmentId: string
): Promise<Certificate | null> {
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('assignment_id', assignmentId)
    .maybeSingle();

  if (error) throw error;
  return data as Certificate | null;
}

export interface ListMyCertificatesFilters {
  courseName?: string;
  completionDateFrom?: string;
  completionDateTo?: string;
  certificateCode?: string;
}

export interface ListMyCertificatesOptions {
  limit?: number;
  offset?: number;
  filters?: ListMyCertificatesFilters;
}

export interface ListMyCertificatesResult {
  data: MyCertificateRow[];
  total: number;
}

export async function listMyCertificates(
  options: ListMyCertificatesOptions = {}
): Promise<ListMyCertificatesResult> {
  const { limit = 20, offset = 0, filters } = options;
  const { data, error } = await supabase.rpc('get_my_certificates', {
    p_limit: limit,
    p_offset: offset,
    p_course_name: filters?.courseName?.trim() || null,
    p_completion_date_from: filters?.completionDateFrom || null,
    p_completion_date_to: filters?.completionDateTo || null,
    p_certificate_code: filters?.certificateCode?.trim() || null,
  });

  if (error) throw error;
  const rows = (data ?? []) as MyCertificateRow[];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return { data: rows, total };
}

/**
 * Generates a certificate for the assignment if the course is completed.
 * Idempotent: returns existing certificate if already present.
 */
export async function generateCertificateIfEligible(
  assignmentId: string
): Promise<Certificate | null> {
  const { data, error } = await supabase.rpc('generate_certificate_if_eligible', {
    p_assignment_id: assignmentId,
  });

  if (error) throw error;
  return data as Certificate | null;
}

/**
 * Public verification by certificate code (no auth).
 */
export async function getCertificateForVerification(
  code: string
): Promise<CertificateVerificationRow | null> {
  const trimmed = code?.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase.rpc('get_certificate_for_verification', {
    p_code: trimmed,
  });

  if (error) throw error;
  const rows = (data ?? []) as CertificateVerificationRow[];
  return rows.length > 0 ? rows[0] : null;
}
