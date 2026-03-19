-- Migration 073: PDI Evidences (upload + manager review)
-- Requirements:
-- - Collaborator (employee) uploads evidence for a specific PDI action plan or task (pending by default)
-- - Manager reviews (approve/reject + optional feedback) and persists review metadata
-- - Strong backend enforcement via RLS + private storage bucket policies

-- 1) Evidence table
CREATE TABLE IF NOT EXISTS public.pdi_evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Scope (exactly one must be non-null)
  pdi_id UUID NOT NULL REFERENCES public.pdis(id) ON DELETE CASCADE,
  pdi_action_plan_id UUID REFERENCES public.pdi_action_plans(id) ON DELETE CASCADE,
  pdi_plan_action_id UUID REFERENCES public.pdi_plan_actions(id) ON DELETE CASCADE,
  CHECK (
    (pdi_action_plan_id IS NOT NULL AND pdi_plan_action_id IS NULL)
    OR (pdi_action_plan_id IS NULL AND pdi_plan_action_id IS NOT NULL)
  ),

  -- Submitter + state
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

  -- File metadata (backend validates size via trigger)
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  storage_path TEXT NOT NULL UNIQUE,

  -- Review metadata
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  feedback TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdi_evidences_tenant_id ON public.pdi_evidences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pdi_evidences_pdi_id ON public.pdi_evidences(pdi_id);
CREATE INDEX IF NOT EXISTS idx_pdi_evidences_status ON public.pdi_evidences(status);
CREATE INDEX IF NOT EXISTS idx_pdi_evidences_submitted_by ON public.pdi_evidences(submitted_by);

ALTER TABLE public.pdi_evidences ENABLE ROW LEVEL SECURITY;

-- Updated-at helper
CREATE OR REPLACE FUNCTION public.set_pdi_evidences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pdi_evidences_updated_at ON public.pdi_evidences;
CREATE TRIGGER pdi_evidences_updated_at
  BEFORE UPDATE ON public.pdi_evidences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pdi_evidences_updated_at();

-- Backend validation for file size with a clear message
CREATE OR REPLACE FUNCTION public.validate_pdi_evidence_file_size()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.file_size_bytes > 1048576 THEN
    RAISE EXCEPTION 'Arquivo muito grande. Máximo 1MB.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pdi_evidences_validate_file_size ON public.pdi_evidences;
CREATE TRIGGER pdi_evidences_validate_file_size
  BEFORE INSERT OR UPDATE OF file_size_bytes ON public.pdi_evidences
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pdi_evidence_file_size();

-- 2) RLS Policies
-- SELECT:
-- - Collaborator (employee): can read only their own evidences
-- - Manager: can read evidences for direct reports within their tenant
--
-- Notes:
-- - HR is intentionally excluded from SELECT to match "Other roles must not review/upload"
--   (and also avoid accidental data exposure).
CREATE POLICY "PDI evidences: select own (employee)" ON public.pdi_evidences
  FOR SELECT
  USING (
    public.pdi_evidences.submitted_by = auth.uid()
  );

CREATE POLICY "PDI evidences: select direct-report (manager)" ON public.pdi_evidences
  FOR SELECT
  USING (
    public.pdi_evidences.tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
    AND EXISTS (
      SELECT 1
      FROM public.pdis p
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE p.id = public.pdi_evidences.pdi_id
        AND e.manager_id = auth.uid()
    )
  );

-- INSERT:
-- - Only employee can insert pending evidences
-- - Evidence must belong to the employee's own PDI and target
CREATE POLICY "PDI evidences: employee insert own pending" ON public.pdi_evidences
  FOR INSERT
  WITH CHECK (
    public.pdi_evidences.submitted_by = auth.uid()
    AND public.pdi_evidences.status = 'pending'
    AND public.pdi_evidences.reviewed_by IS NULL
    AND (
      SELECT role::text FROM public.profiles WHERE id = auth.uid()
    ) = 'employee'
    AND public.pdi_evidences.tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.pdis p
      WHERE p.id = public.pdi_evidences.pdi_id
        AND p.employee_id = auth.uid()
        AND p.tenant_id = public.pdi_evidences.tenant_id
    )
    AND (
      -- Action plan evidence
      (
        public.pdi_evidences.pdi_action_plan_id IS NOT NULL
        AND public.pdi_evidences.pdi_plan_action_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.pdi_action_plans ap
          WHERE ap.id = public.pdi_evidences.pdi_action_plan_id
            AND ap.pdi_id = public.pdi_evidences.pdi_id
        )
      )
      OR
      -- Task evidence (plan action)
      (
        public.pdi_evidences.pdi_plan_action_id IS NOT NULL
        AND public.pdi_evidences.pdi_action_plan_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.pdi_plan_actions a
          JOIN public.pdi_action_plans ap ON ap.id = a.pdi_action_plan_id
          WHERE a.id = public.pdi_evidences.pdi_plan_action_id
            AND ap.pdi_id = public.pdi_evidences.pdi_id
        )
      )
    )
  );

-- UPDATE (review):
-- - Only manager can update pending evidence to approved/rejected
-- - Must set reviewed_by to auth.uid()
CREATE POLICY "PDI evidences: manager review pending" ON public.pdi_evidences
  FOR UPDATE
  USING (
    public.pdi_evidences.status = 'pending'
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
    AND public.pdi_evidences.tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.pdis p
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE p.id = public.pdi_evidences.pdi_id
        AND e.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    public.pdi_evidences.tenant_id = (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
    AND public.pdi_evidences.reviewed_by = auth.uid()
    AND public.pdi_evidences.reviewed_at IS NOT NULL
    AND public.pdi_evidences.status IN ('approved', 'rejected')
  );

-- DELETE (cleanup for pending):
-- - Collaborator can delete only their own pending evidence
CREATE POLICY "PDI evidences: employee delete pending own" ON public.pdi_evidences
  FOR DELETE
  USING (
    public.pdi_evidences.submitted_by = auth.uid()
    AND public.pdi_evidences.status = 'pending'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdi_evidences TO authenticated;

-- 3) Storage bucket: pdi-evidences (private)
-- Path format: {tenant_id}/evidences/{evidence_id}/{original_file_name}
-- Only auth rules allow reading/updating.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdi-evidences',
  'pdi-evidences',
  false,
  1048576,
  ARRAY[
    'application/pdf',
    -- Images
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    -- Common office docs
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    -- Plain text / open docs
    'text/plain',
    'application/rtf',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Collaborators/Managers can read evidence files (signed URLs rely on this)
CREATE POLICY "PDI evidences storage: select by table scope" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pdi-evidences'
    AND EXISTS (
      SELECT 1
      FROM public.pdi_evidences pe
      JOIN public.pdis p ON p.id = pe.pdi_id
      JOIN public.profiles e ON e.id = p.employee_id
      WHERE pe.id = (storage.foldername(name))[3]::uuid
        AND pe.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
          pe.submitted_by = auth.uid()
          OR (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
            AND e.manager_id = auth.uid()
          )
        )
    )
  );

-- Collaborator can upload to their own evidence path
CREATE POLICY "PDI evidences storage: insert own pending" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pdi-evidences'
    AND (storage.foldername(name))[1] = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())::text
    AND (storage.foldername(name))[2] = 'evidences'
    AND EXISTS (
      SELECT 1
      FROM public.pdi_evidences pe
      WHERE pe.id = (storage.foldername(name))[3]::uuid
        AND pe.submitted_by = auth.uid()
        AND pe.status = 'pending'
    )
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'employee'
  );

-- Allow collaborator to delete their own pending evidence file (optional cleanup)
CREATE POLICY "PDI evidences storage: delete own pending" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pdi-evidences'
    AND EXISTS (
      SELECT 1
      FROM public.pdi_evidences pe
      WHERE pe.id = (storage.foldername(name))[3]::uuid
        AND pe.submitted_by = auth.uid()
        AND pe.status = 'pending'
    )
  );

-- 4) Extend notifications type check constraint for evidence review
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'evaluation_received',
    'feedback_received',
    'evaluation_period_reminder',
    'assessment_period_reminder',
    'mandatory_course_assigned',
    'course_assigned',
    'pdi_action_plan_reminder',
    'pdi_evidence_approved',
    'pdi_evidence_rejected'
  )
);

