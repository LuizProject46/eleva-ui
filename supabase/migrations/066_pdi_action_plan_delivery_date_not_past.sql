-- Migration 066: Enforce delivery_date >= current date on pdi_action_plans.
-- Prevents saving action plans with a past delivery date (create and update).

-- 1) Normalize existing rows so ADD CONSTRAINT does not fail
UPDATE public.pdi_action_plans
SET delivery_date = CURRENT_DATE
WHERE delivery_date < CURRENT_DATE;

-- 2) Enforce rule for all future inserts and updates
ALTER TABLE public.pdi_action_plans
  ADD CONSTRAINT chk_pdi_action_plan_delivery_date_not_past
  CHECK (delivery_date >= CURRENT_DATE);

COMMENT ON CONSTRAINT chk_pdi_action_plan_delivery_date_not_past ON public.pdi_action_plans
  IS 'Delivery date must be today or in the future.';
