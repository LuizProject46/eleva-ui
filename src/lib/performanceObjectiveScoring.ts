import type { PerformanceObjectiveRow } from '@/types/performanceObjective';

/**
 * Weighted average of manager ratings (1–3) by `item_weight` (allocation %).
 * When weights sum to 100, this equals sum(rating × weight) / 100 on the 1–3 scale.
 * Returns null if there are no rows or any row is missing a rating.
 */
export function computeObjectivesWeightedAverage(
  objectives: PerformanceObjectiveRow[]
): number | null {
  if (objectives.length === 0) return null;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const o of objectives) {
    if (o.rating === null || o.rating === undefined) return null;
    const w = Number(o.item_weight);
    if (!Number.isFinite(w) || w <= 0) return null;
    weightedSum += o.rating * w;
    weightTotal += w;
  }
  if (weightTotal === 0) return null;
  return weightedSum / weightTotal;
}
