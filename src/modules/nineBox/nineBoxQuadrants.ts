import type { NineBoxAxisLevel } from '@/types/nineBox';

export type NineBoxTier = 'high' | 'mid' | 'low';

export interface NineBoxQuadrantMeta {
  label: string;
  tier: NineBoxTier;
  /** Cell background + border (Tailwind, design tokens) */
  cellClassName: string;
}

const GRID_LABELS: Record<string, string> = {
  'high|high': 'Estrela',
  'high|medium': 'Alto desempenho',
  'high|low': 'Profissional sólido',
  'medium|high': 'Alto potencial',
  'medium|medium': 'Em desenvolvimento',
  'medium|low': 'Eficiente',
  'low|high': 'Enigma',
  'low|medium': 'Questionável',
  'low|low': 'Baixa contribuição',
};

function tierFor(performance: NineBoxAxisLevel, potential: NineBoxAxisLevel): NineBoxTier {
  const p = performance === 'high' ? 2 : performance === 'medium' ? 1 : 0;
  const pot = potential === 'high' ? 2 : potential === 'medium' ? 1 : 0;
  const score = p + pot;
  if (score >= 3) return 'high';
  if (score >= 2) return 'mid';
  return 'low';
}

function cellClassFor(tier: NineBoxTier): string {
  if (tier === 'high') {
    return 'bg-primary/15 border-primary/35 hover:bg-primary/20';
  }
  if (tier === 'mid') {
    return 'bg-accent/12 border-accent/30 hover:bg-accent/18';
  }
  return 'bg-muted/80 border-border/80 hover:bg-muted';
}

export function getNineBoxQuadrantMeta(
  performance: NineBoxAxisLevel,
  potential: NineBoxAxisLevel
): NineBoxQuadrantMeta {
  const key = `${performance}|${potential}`;
  const tier = tierFor(performance, potential);
  return {
    label: GRID_LABELS[key] ?? '—',
    tier,
    cellClassName: cellClassFor(tier),
  };
}

export function nineBoxBadgeClassName(tier: NineBoxTier): string {
  if (tier === 'high') {
    return 'bg-primary/15 text-primary border-primary/30';
  }
  if (tier === 'mid') {
    return 'bg-accent/15 text-foreground border-accent/25';
  }
  return 'bg-muted text-muted-foreground border-border';
}

/** Matrix iteration order: rows = performance high → low, cols = potential low → high */
export const NINE_BOX_PERFORMANCE_ORDER: NineBoxAxisLevel[] = ['high', 'medium', 'low'];
export const NINE_BOX_POTENTIAL_ORDER: NineBoxAxisLevel[] = ['low', 'medium', 'high'];

export const NINE_BOX_AXIS_LABELS: Record<NineBoxAxisLevel, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
};
