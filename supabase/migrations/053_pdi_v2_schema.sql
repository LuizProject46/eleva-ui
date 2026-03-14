-- Migration 053: PDI v2 schema (additive, safe)
-- Goal: introduce a simplified, explicit domain model without coupling to Courses.
-- Notes:
-- - This migration is additive only (no drops), enabling safe backfill + cutover.
-- - Course automation + RPC cleanup happens in later migrations.

-- 1) Competencies (tenant-scoped catalog used by PDI gaps)
CREATE TABLE IF NOT EXISTS public.competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_competencies_tenant_id ON public.competencies(tenant_id);

COMMENT ON TABLE public.competencies IS 'Tenant-scoped competency catalog for PDI (decoupled from evaluation_competencies).';

ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;

-- 2) PDI gaps (replaces pdi_objectives in v2). One PDI can have multiple gaps/competencies.
CREATE TABLE IF NOT EXISTS public.pdi_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdi_id UUID NOT NULL REFERENCES public.pdis(id) ON DELETE CASCADE,
  competency_id UUID REFERENCES public.competencies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  current_level INT CHECK (current_level IS NULL OR (current_level >= 1 AND current_level <= 5)),
  target_level INT CHECK (target_level IS NULL OR (target_level >= 1 AND target_level <= 5)),
  due_date DATE,
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdi_gaps_pdi_id ON public.pdi_gaps(pdi_id);
CREATE INDEX IF NOT EXISTS idx_pdi_gaps_competency_id ON public.pdi_gaps(competency_id);

COMMENT ON TABLE public.pdi_gaps IS 'PDI gaps (Competency → Gap). Each gap belongs to a PDI and optionally references a tenant competency.';

ALTER TABLE public.pdi_gaps ENABLE ROW LEVEL SECURITY;

-- 3) Wire actions to gaps (v2 path). Keep legacy objective FK for now to allow safe cutover.
ALTER TABLE public.pdi_actions
  ADD COLUMN IF NOT EXISTS pdi_gap_id UUID REFERENCES public.pdi_gaps(id) ON DELETE CASCADE;

ALTER TABLE public.pdi_actions
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pdi_actions_pdi_gap_id ON public.pdi_actions(pdi_gap_id);

COMMENT ON COLUMN public.pdi_actions.pdi_gap_id IS 'v2: links action to a PDI gap (replaces pdi_objective_id after cutover).';
COMMENT ON COLUMN public.pdi_actions.created_by IS 'User that created the action (used for explicit update permissions in v2).';

