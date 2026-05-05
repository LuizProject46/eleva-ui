import type {
  PerformanceCompetencyAssignmentRow,
  PerformanceCompetencyEvaluationRow,
} from '@/types/performanceCompetency';

export function computeCompetenciesWeightedAverage(params: {
  assignments: PerformanceCompetencyAssignmentRow[];
  evaluations: PerformanceCompetencyEvaluationRow[];
}): number | null {
  const { assignments, evaluations } = params;
  if (assignments.length === 0) return null;

  const ratingByCompetencyId = new Map<string, number | null>();
  for (const evaluation of evaluations) {
    ratingByCompetencyId.set(evaluation.competency_id, evaluation.rating);
  }

  let weightedSum = 0;
  let weightTotal = 0;

  for (const assignment of assignments) {
    const rating = ratingByCompetencyId.get(assignment.competency_id);
    const weight = Number(assignment.item_weight);
    if (!Number.isInteger(rating) || rating == null || rating < 1 || rating > 3) return null;
    if (!Number.isFinite(weight) || weight <= 0) return null;

    weightedSum += rating * weight;
    weightTotal += weight;
  }

  if (weightTotal <= 0) return null;
  return weightedSum / weightTotal;
}
