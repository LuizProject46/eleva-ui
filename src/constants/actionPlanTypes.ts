/**
 * Action Plan type options for PDI. Centralized so HR can change labels/values later.
 */

export const ACTION_PLAN_TYPES = [
  'technical_development',
  'soft_skills',
  'training',
  'certification',
  'mentorship',
  'practical_project',
] as const;

export type ActionPlanType = (typeof ACTION_PLAN_TYPES)[number];

export const ACTION_PLAN_TYPE_OPTIONS: { value: ActionPlanType; label: string }[] = [
  { value: 'technical_development', label: 'Desenvolvimento técnico' },
  { value: 'soft_skills', label: 'Soft skills' },
  { value: 'training', label: 'Treinamento' },
  { value: 'certification', label: 'Certificação' },
  { value: 'mentorship', label: 'Mentoria' },
  { value: 'practical_project', label: 'Projeto prático' },
];

export const ACTION_PLAN_TYPE_LABELS: Record<ActionPlanType, string> = Object.fromEntries(
  ACTION_PLAN_TYPE_OPTIONS.map((o) => [o.value, o.label])
) as Record<ActionPlanType, string>;
