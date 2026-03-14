-- Migration 057: Remove PDI hidden automation and legacy RPCs
-- Goals:
-- - Remove Course -> PDI implicit synchronization (triggers/functions)
-- - Remove PDI progress/status RPCs (status/progress derived in frontend)

-- 1) Course -> PDI automation (triggers)
DROP TRIGGER IF EXISTS pdi_sync_on_roadmap_progress ON public.course_roadmap_item_progress;
DROP TRIGGER IF EXISTS pdi_sync_on_questionnaire_attempt ON public.course_questionnaire_attempts;

-- 2) Trigger function
DROP FUNCTION IF EXISTS public.sync_pdi_actions_on_course_completion();

-- 3) Course progress helper (used by PDI RPCs)
DROP FUNCTION IF EXISTS public.get_course_assignment_progress(UUID);

-- 4) PDI RPCs (legacy)
DROP FUNCTION IF EXISTS public.get_pdi_progress(UUID);
DROP FUNCTION IF EXISTS public.get_pdi_goal_progress(UUID);
DROP FUNCTION IF EXISTS public.get_pdi_action_progress(UUID);

