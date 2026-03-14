-- Migration 054: PDI v2 backups + backfill (safe, no drops)
-- - Create temporary backup snapshots of legacy tables
-- - Backfill competencies and gaps from legacy pdi_objectives
-- - Link existing pdi_actions rows to newly created gaps (pdi_gap_id)
-- - Backfill created_by for gaps/actions where possible

-- 0) Backups (never delete data without a temporary backup)
CREATE TABLE IF NOT EXISTS public._legacy_backup_20260304_pdi_objectives AS
SELECT * FROM public.pdi_objectives;

CREATE TABLE IF NOT EXISTS public._legacy_backup_20260304_pdi_actions AS
SELECT * FROM public.pdi_actions;

CREATE TABLE IF NOT EXISTS public._legacy_backup_20260304_pdi_checkins AS
SELECT * FROM public.pdi_checkins;

COMMENT ON TABLE public._legacy_backup_20260304_pdi_objectives IS 'Temporary backup created by migration 054 before PDI v2 cutover.';
COMMENT ON TABLE public._legacy_backup_20260304_pdi_actions IS 'Temporary backup created by migration 054 before PDI v2 cutover.';
COMMENT ON TABLE public._legacy_backup_20260304_pdi_checkins IS 'Temporary backup created by migration 054 before PDI v2 cutover.';

-- 1) Backfill tenant-scoped competencies from legacy objectives (free-text competency)
INSERT INTO public.competencies (tenant_id, name)
SELECT DISTINCT p.tenant_id, o.competency
FROM public.pdi_objectives o
JOIN public.pdis p ON p.id = o.pdi_id
WHERE o.competency IS NOT NULL AND btrim(o.competency) <> ''
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 2) Backfill gaps from legacy objectives
-- Mapping:
-- - gap.title = objective.description (preserves legacy goal text)
-- - gap.competency_id = tenant competency by name (when provided)
INSERT INTO public.pdi_gaps (pdi_id, competency_id, title, due_date, position, created_by)
SELECT
  o.pdi_id,
  c.id AS competency_id,
  o.description AS title,
  o.due_date,
  o.position,
  p.created_by
FROM public.pdi_objectives o
JOIN public.pdis p ON p.id = o.pdi_id
LEFT JOIN public.competencies c
  ON c.tenant_id = p.tenant_id
 AND c.name = o.competency
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pdi_gaps g
  WHERE g.pdi_id = o.pdi_id
    AND g.title = o.description
    AND g.position = o.position
);

-- 3) Link existing actions to gaps
-- We match by (objective_id -> objective fields -> gap) using title+position within the same PDI.
UPDATE public.pdi_actions a
SET
  pdi_gap_id = g.id,
  created_by = COALESCE(a.created_by, p.created_by)
FROM public.pdi_objectives o
JOIN public.pdis p ON p.id = o.pdi_id
JOIN public.pdi_gaps g
  ON g.pdi_id = o.pdi_id
 AND g.title = o.description
 AND g.position = o.position
WHERE a.pdi_objective_id = o.id
  AND a.pdi_gap_id IS NULL;

-- 4) Backfill any remaining created_by on actions from the parent PDI (best-effort)
UPDATE public.pdi_actions a
SET created_by = p.created_by
FROM public.pdi_gaps g
JOIN public.pdis p ON p.id = g.pdi_id
WHERE a.pdi_gap_id = g.id
  AND a.created_by IS NULL;

