-- Migration 064: PDI Action Plan reminder tracking and notification type.
-- Adds reminder_sent_at to avoid duplicate reminders; extends notifications.type for in-app reminders.

-- 1) Track whether a reminder was sent for this action plan
ALTER TABLE public.pdi_action_plans
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.pdi_action_plans.reminder_sent_at IS 'When a delivery-date reminder was sent (employee + manager). Used to avoid duplicate reminders.';

-- 2) Allow pdi_action_plan_reminder in notifications
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'evaluation_received',
    'feedback_received',
    'evaluation_period_reminder',
    'assessment_period_reminder',
    'mandatory_course_assigned',
    'course_assigned',
    'pdi_action_plan_reminder'
  )
);
