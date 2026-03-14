import type { PdiType } from '@/types/pdi';

export const PDI_TYPE_OPTIONS: { value: PdiType; label: string }[] = [
  { value: 'technical_skill', label: 'Desenvolvimento de competência técnica' },
  { value: 'behavioral', label: 'Desenvolvimento comportamental' },
  { value: 'leadership', label: 'Desenvolvimento de liderança' },
  { value: 'career_growth', label: 'Crescimento de carreira' },
  { value: 'performance_improvement', label: 'Melhoria de desempenho' },
];

export const PDI_TYPE_LABELS: Record<PdiType, string> = Object.fromEntries(
  PDI_TYPE_OPTIONS.map((o) => [o.value, o.label])
) as Record<PdiType, string>;
