-- Migration 074: Fix pdi-evidences storage policy path parsing
-- Root cause: storage.foldername(name)[N] indexes can be unreliable depending on path shape.
-- We switch to split_part(name,'/',N) with safe UUID extraction to prevent policy denial.

-- Drop and recreate storage policies for pdi-evidences bucket.
DROP POLICY IF EXISTS "PDI evidences storage: select by table scope" ON storage.objects;
DROP POLICY IF EXISTS "PDI evidences storage: insert own pending" ON storage.objects;
DROP POLICY IF EXISTS "PDI evidences storage: delete own pending" ON storage.objects;

-- SELECT: allow collaborator (own evidences) and manager (direct reports) to create signed URLs.
CREATE POLICY "PDI evidences storage: select by table scope" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pdi-evidences'
    AND EXISTS (
      SELECT 1
      FROM public.pdi_evidences pe
      WHERE pe.id = (
        CASE
          WHEN split_part(name, '/', 3) ~ '^[0-9a-fA-F-]{36}$'
          THEN split_part(name, '/', 3)::uuid
          ELSE NULL
        END
      )
        AND pe.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        AND (
          pe.submitted_by = auth.uid()
          OR (
            (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'manager'
            AND EXISTS (
              SELECT 1
              FROM public.pdis p
              JOIN public.profiles e ON e.id = p.employee_id
              WHERE p.id = pe.pdi_id
                AND e.manager_id = auth.uid()
            )
          )
        )
    )
  );

-- INSERT: collaborator uploads only to their pending evidence path.
CREATE POLICY "PDI evidences storage: insert own pending" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pdi-evidences'
    AND split_part(name, '/', 1) = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())::text
    AND split_part(name, '/', 2) = 'evidences'
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'employee'
    AND EXISTS (
      SELECT 1
      FROM public.pdi_evidences pe
      WHERE pe.id = (
        CASE
          WHEN split_part(name, '/', 3) ~ '^[0-9a-fA-F-]{36}$'
          THEN split_part(name, '/', 3)::uuid
          ELSE NULL
        END
      )
        AND pe.submitted_by = auth.uid()
        AND pe.status = 'pending'
    )
  );

-- DELETE: collaborator can delete only their own pending evidence file.
CREATE POLICY "PDI evidences storage: delete own pending" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pdi-evidences'
    AND EXISTS (
      SELECT 1
      FROM public.pdi_evidences pe
      WHERE pe.id = (
        CASE
          WHEN split_part(name, '/', 3) ~ '^[0-9a-fA-F-]{36}$'
          THEN split_part(name, '/', 3)::uuid
          ELSE NULL
        END
      )
        AND pe.submitted_by = auth.uid()
        AND pe.status = 'pending'
    )
  );

