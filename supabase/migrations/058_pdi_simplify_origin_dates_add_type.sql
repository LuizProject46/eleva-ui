-- Migration 058: PDI simplify — add type and title; legacy columns kept for data, app stops using them
-- - Add type (required for new rows; backfill existing)
-- - Add title (nullable)
-- - Do NOT drop start_date, end_date, origin, evaluation_id, behavioral_assessment_id (legacy data only)

ALTER TABLE public.pdis
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Backfill existing rows so we can add NOT NULL
UPDATE public.pdis SET type = 'performance_improvement' WHERE type IS NULL;

ALTER TABLE public.pdis
  ALTER COLUMN type SET NOT NULL;

-- Constrain type to HR-defined values
ALTER TABLE public.pdis
  DROP CONSTRAINT IF EXISTS pdis_type_check;

ALTER TABLE public.pdis
  ADD CONSTRAINT pdis_type_check CHECK (
    type IN (
      'technical_skill',
      'behavioral',
      'leadership',
      'career_growth',
      'performance_improvement'
    )
  );

CREATE INDEX IF NOT EXISTS idx_pdis_type ON public.pdis(type);

COMMENT ON COLUMN public.pdis.type IS 'HR-defined PDI category (replaces origin).';
COMMENT ON COLUMN public.pdis.title IS 'Optional display title for the PDI.';
