/**
 * PDI evidences: collaborator uploads files (pending) and managers review (approved/rejected).
 * Backend enforcement is handled by Supabase RLS + private Storage bucket policies.
 */
import { supabase } from '@/lib/supabase';
import type { PdiEvidence, PdiEvidenceStatus } from '@/types/pdi';

const PDI_EVIDENCES_BUCKET = 'pdi-evidences';
const MAX_PDI_EVIDENCE_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // Common office docs
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text / open docs
  'text/plain',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
] as const;

const ALLOWED_EXTENSIONS = [
  'pdf',
  // Images
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  // Office docs
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  // Text/open docs
  'txt',
  'rtf',
  'odt',
  'ods',
  'odp',
] as const;

type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];
type AllowedExt = (typeof ALLOWED_EXTENSIONS)[number];

const EXT_TO_MIME: Record<AllowedExt, AllowedMime> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
};

function getFileExtension(fileName: string): string | null {
  const trimmed = fileName.trim();
  const idx = trimmed.lastIndexOf('.');
  if (idx < 0) return null;
  const ext = trimmed.slice(idx + 1).toLowerCase();
  return ext || null;
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[\\/]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
  const trimmed = cleaned.trim();
  if (!trimmed) return `file-${Date.now()}`;
  return trimmed;
}

function resolveEvidenceContentType(file: File): AllowedMime | null {
  const fileType = file.type as AllowedMime | '';
  if (fileType && ALLOWED_MIME_TYPES.includes(fileType)) return fileType;

  const ext = getFileExtension(file.name) as AllowedExt | null;
  if (!ext) return null;
  const mime = EXT_TO_MIME[ext];
  return mime ?? null;
}

export function validatePdiEvidenceFile(file: File): string | null {
  if (file.size > MAX_PDI_EVIDENCE_FILE_SIZE_BYTES) {
    return 'Arquivo muito grande. Máximo 1MB.';
  }

  const resolved = resolveEvidenceContentType(file);
  if (!resolved) {
    return 'Formato inválido. Envie PDF, imagens ou documentos (até 1MB).';
  }
  return null;
}

function buildEvidenceStoragePath(tenantId: string, evidenceId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  return `${tenantId}/evidences/${evidenceId}/${safeName}`;
}

export async function listPdiEvidencesByPdi(params: {
  pdiId: string;
  status?: PdiEvidenceStatus | 'all';
  limit?: number;
  offset?: number;
}): Promise<{ data: PdiEvidence[]; total: number }> {
  const { pdiId, status = 'all', limit = 50, offset = 0 } = params;

  let query = supabase
    .from('pdi_evidences')
    .select('*', { count: 'exact' })
    .eq('pdi_id', pdiId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: (data ?? []) as PdiEvidence[], total: count ?? 0 };
}

export async function createPdiEvidenceRecord(params: {
  tenantId: string;
  pdiId: string;
  submittedBy: string;
  pdiActionPlanId?: string | null;
  pdiPlanActionId?: string | null;
  file: File;
}): Promise<PdiEvidence> {
  const { tenantId, pdiId, submittedBy, pdiActionPlanId = null, pdiPlanActionId = null, file } = params;

  if ((pdiActionPlanId && pdiPlanActionId) || (!pdiActionPlanId && !pdiPlanActionId)) {
    throw new Error('Informe apenas um alvo: action plan ou tarefa.');
  }

  const validationError = validatePdiEvidenceFile(file);
  if (validationError) throw new Error(validationError);

  const contentType = resolveEvidenceContentType(file);
  if (!contentType) throw new Error('Formato inválido.');

  const evidenceId = crypto.randomUUID();
  const storagePath = buildEvidenceStoragePath(tenantId, evidenceId, file.name);

  const { data, error } = await supabase
    .from('pdi_evidences')
    .insert({
      id: evidenceId,
      tenant_id: tenantId,
      pdi_id: pdiId,
      pdi_action_plan_id: pdiActionPlanId,
      pdi_plan_action_id: pdiPlanActionId,
      submitted_by: submittedBy,
      status: 'pending',
      file_name: file.name,
      content_type: contentType,
      file_size_bytes: file.size,
      storage_path: storagePath,
      reviewed_by: null,
      reviewed_at: null,
      feedback: null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message ?? 'Erro ao salvar evidência.');
  return data as PdiEvidence;
}

export async function uploadPdiEvidenceFile(params: {
  storagePath: string;
  file: File;
}): Promise<void> {
  const { storagePath, file } = params;

  const validationError = validatePdiEvidenceFile(file);
  if (validationError) throw new Error(validationError);

  const contentType = resolveEvidenceContentType(file);
  if (!contentType) throw new Error('Formato inválido.');

  const { error } = await supabase.storage
    .from(PDI_EVIDENCES_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType });

  if (error) throw new Error(error.message ?? 'Falha ao enviar arquivo.');
}

export async function deletePdiEvidenceRecord(params: {
  evidenceId: string;
  storagePath?: string;
}): Promise<void> {
  const { evidenceId, storagePath } = params;

  const { error: dbError } = await supabase.from('pdi_evidences').delete().eq('id', evidenceId);
  if (dbError) throw new Error(dbError.message ?? 'Erro ao excluir evidência.');

  if (!storagePath) return;

  const { error: storageError } = await supabase.storage.from(PDI_EVIDENCES_BUCKET).remove([storagePath]);
  if (storageError) {
    // Storage cleanup should not break the UX if DB deletion succeeded.
    // eslint-disable-next-line no-console
    console.warn('Storage cleanup failed:', storageError.message ?? storageError);
  }
}

export async function reviewPdiEvidence(params: {
  evidenceId: string;
  reviewedBy: string;
  status: Exclude<PdiEvidenceStatus, 'pending'>;
  feedback?: string | null;
}): Promise<PdiEvidence> {
  const { evidenceId, reviewedBy, status, feedback = null } = params;

  const cleanedFeedback = typeof feedback === 'string' ? (feedback.trim() || null) : null;
  const reviewedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('pdi_evidences')
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: reviewedAt,
      feedback: cleanedFeedback,
    })
    .eq('id', evidenceId)
    .select('*')
    .single();

  if (error) throw new Error(error.message ?? 'Erro ao revisar evidência.');
  return data as PdiEvidence;
}

export async function getPdiEvidenceSignedUrl(params: {
  storagePath: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { storagePath, expiresInSeconds = 3600 } = params;

  const { data, error } = await supabase.storage
    .from(PDI_EVIDENCES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) throw new Error(error.message ?? 'Falha ao gerar URL.');
  if (!data?.signedUrl) throw new Error('Falha ao gerar URL.');
  return data.signedUrl;
}

