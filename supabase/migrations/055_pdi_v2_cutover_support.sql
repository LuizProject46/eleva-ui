-- Migration 055: PDI v2 cutover support (safe)
-- Enables creating actions linked to v2 gaps without requiring legacy objectives.

-- 1) Allow pdi_actions to link via pdi_gap_id only (legacy objective becomes optional)
ALTER TABLE public.pdi_actions
  ALTER COLUMN pdi_objective_id DROP NOT NULL;

-- 2) Ensure an action is always attached to either legacy objective or v2 gap
DO $$
BEGIN
  ALTER TABLE public.pdi_actions
    ADD CONSTRAINT pdi_actions_parent_ref_check
    CHECK (pdi_objective_id IS NOT NULL OR pdi_gap_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

