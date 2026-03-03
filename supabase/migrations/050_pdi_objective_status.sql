-- PDI objective lifecycle: status (not_started, in_progress, completed).
-- Progress is manually updated by HR/Manager only; no auto-derive from actions.

ALTER TABLE pdi_objectives
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_started'
  CHECK (status IN ('not_started', 'in_progress', 'completed'));

COMMENT ON COLUMN pdi_objectives.status IS 'Objective progress: not_started, in_progress, completed. Manually set by HR/Manager only.';
