-- Migration 061: Drop legacy PDI tables (check-ins, gaps, actions)
-- Application uses pdi_action_plans and pdi_plan_actions only.
-- Using DROP TABLE IF EXISTS only: dropping the table automatically drops its RLS policies.
-- Order: drop dependent tables first (pdi_actions references pdi_gaps and pdi_objectives).

DROP TABLE IF EXISTS public.pdi_actions;
DROP TABLE IF EXISTS public.pdi_gaps;
DROP TABLE IF EXISTS public.pdi_objectives;
DROP TABLE IF EXISTS public.pdi_checkins;
DROP TABLE IF EXISTS public.competencies;
