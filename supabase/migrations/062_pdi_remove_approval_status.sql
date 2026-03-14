-- Migration 062: Remove PDI approval workflow (drop in_approval status).
-- PDIs become a simple editable development plan without approval dependencies.

-- 1) Backfill: move any in_approval PDIs to active so no row is stuck
UPDATE public.pdis
SET status = 'active'
WHERE status = 'in_approval';

-- 2) Drop and re-add CHECK constraint without in_approval
ALTER TABLE public.pdis DROP CONSTRAINT IF EXISTS pdis_status_check;
ALTER TABLE public.pdis ADD CONSTRAINT pdis_status_check
  CHECK (status IN ('draft', 'active', 'closed', 'archived'));

COMMENT ON TABLE public.pdis IS 'Individual development plans; status: draft -> active -> closed -> archived (no approval step).';
