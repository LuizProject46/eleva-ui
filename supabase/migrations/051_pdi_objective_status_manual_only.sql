-- Remove auto-derive of objective status from actions (plan: manual only).
-- Safe to run even if 050 was the minimal version (no-op).

DROP TRIGGER IF EXISTS pdi_actions_sync_objective_status ON pdi_actions;
DROP FUNCTION IF EXISTS public.trigger_sync_pdi_objective_status();
DROP FUNCTION IF EXISTS public.sync_pdi_objective_status_from_actions(UUID);
DROP FUNCTION IF EXISTS public.get_pdi_objective_progress(UUID);
