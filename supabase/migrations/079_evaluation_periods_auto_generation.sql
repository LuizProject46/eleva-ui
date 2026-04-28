-- Migration 079: Additive fields for auto-generated evaluation periods from periodicity_config.
-- Manual rows keep source_entity_type NULL and is_auto_generated false.
-- Semester becomes nullable for non-semiannual cycles.

ALTER TABLE public.evaluation_periods
  DROP CONSTRAINT IF EXISTS evaluation_periods_semester_check;

ALTER TABLE public.evaluation_periods
  ADD CONSTRAINT evaluation_periods_semester_check
  CHECK (semester IS NULL OR semester IN (1, 2));

ALTER TABLE public.evaluation_periods
  ADD COLUMN IF NOT EXISTS source_entity_type TEXT
    CHECK (source_entity_type IS NULL OR source_entity_type IN ('evaluation', 'assessment'));

ALTER TABLE public.evaluation_periods
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.evaluation_periods
  ADD COLUMN IF NOT EXISTS auto_cycle_start_date DATE;

ALTER TABLE public.evaluation_periods
  ADD COLUMN IF NOT EXISTS auto_interval_kind TEXT
    CHECK (
      auto_interval_kind IS NULL
      OR auto_interval_kind IN ('bimonthly', 'quarterly', 'semiannual', 'annual', 'custom')
    );

ALTER TABLE public.evaluation_periods
  ADD COLUMN IF NOT EXISTS generated_from_config_at TIMESTAMPTZ;

COMMENT ON COLUMN public.evaluation_periods.source_entity_type IS
  'For auto rows: periodicity entity (evaluation | assessment). NULL = legacy/manual period.';

COMMENT ON COLUMN public.evaluation_periods.is_auto_generated IS
  'True when row was created by generate_evaluation_periods_*; manual HR rows stay false.';

COMMENT ON COLUMN public.evaluation_periods.auto_cycle_start_date IS
  'Cycle start date (aligned with periodicity_config); used for idempotent upsert.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluation_periods_auto_dedupe
  ON public.evaluation_periods (tenant_id, source_entity_type, auto_cycle_start_date)
  WHERE is_auto_generated = true
    AND auto_cycle_start_date IS NOT NULL
    AND source_entity_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evaluation_periods_tenant_starts_at
  ON public.evaluation_periods (tenant_id, starts_at DESC);

-- Optional: tenant + source filter (evaluation + legacy manual rows)
CREATE INDEX IF NOT EXISTS idx_evaluation_periods_tenant_source
  ON public.evaluation_periods (tenant_id, source_entity_type)
  WHERE source_entity_type IS NULL OR source_entity_type <> 'assessment';
