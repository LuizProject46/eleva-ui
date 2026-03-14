-- Migration 063: Enforce required description and delivery_date on pdi_action_plans.

-- 1) Backfill nulls so we can add NOT NULL (avoid breaking existing rows)
UPDATE public.pdi_action_plans
SET description = COALESCE(NULLIF(TRIM(description), ''), '(Sem descrição)')
WHERE description IS NULL OR TRIM(description) = '';

UPDATE public.pdi_action_plans
SET delivery_date = COALESCE(delivery_date, (CURRENT_DATE + 30)::date)
WHERE delivery_date IS NULL;

-- 2) Enforce NOT NULL
ALTER TABLE public.pdi_action_plans
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN delivery_date SET NOT NULL;

COMMENT ON COLUMN public.pdi_action_plans.description IS 'Required. Description of the action plan.';
COMMENT ON COLUMN public.pdi_action_plans.delivery_date IS 'Required. Target delivery date for the action plan.';
