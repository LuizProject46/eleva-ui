-- Migration 059: Drop legacy PDI columns (origin, dates, evaluation/DISC links)
-- Application now uses only type, title, created_at. New inserts must not require removed columns.

-- Drop indexes that reference the columns we are dropping (optional; dropping column drops its index in PG)
DROP INDEX IF EXISTS public.idx_pdis_start_date;
DROP INDEX IF EXISTS public.idx_pdis_end_date;

ALTER TABLE public.pdis
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS end_date,
  DROP COLUMN IF EXISTS origin,
  DROP COLUMN IF EXISTS evaluation_id,
  DROP COLUMN IF EXISTS behavioral_assessment_id;
