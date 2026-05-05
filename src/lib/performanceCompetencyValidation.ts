import type {
  EvaluationCompetencyRow,
  PerformanceCompetencyAssignmentRow,
  PerformanceCompetencyEvaluationRow,
} from '@/types/performanceCompetency';

const WEIGHT_TOLERANCE = 0.0001;

export function parseWeightPercent(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

export function percentToDecimal(percent: number): number {
  return Math.round((percent / 100) * 10000) / 10000;
}

export function decimalToPercent(decimalWeight: number): number {
  return Math.round(decimalWeight * 10000) / 100;
}

export interface RebalancedWeightItem {
  id: string;
  weightPercent: number;
}

export function rebalanceWeightsProportionally(params: {
  editedAssignmentId: string;
  editedWeightPercent: number;
  assignments: RebalancedWeightItem[];
}): RebalancedWeightItem[] | null {
  const TOTAL_UNITS = 10000; // 100.00%
  const MIN_UNITS_PER_ASSIGNMENT = 1; // 0.01%

  const edited = params.assignments.find((item) => item.id === params.editedAssignmentId);
  if (!edited) return null;

  const others = params.assignments.filter((item) => item.id !== params.editedAssignmentId);
  if (others.length === 0) {
    return [{ id: edited.id, weightPercent: 100 }];
  }

  const editedUnits = Math.round(params.editedWeightPercent * 100);
  const maxEditedUnits = TOTAL_UNITS - others.length * MIN_UNITS_PER_ASSIGNMENT;
  if (editedUnits < MIN_UNITS_PER_ASSIGNMENT || editedUnits > maxEditedUnits) return null;

  const remainingUnits = TOTAL_UNITS - editedUnits;
  const minimumAllocatedUnits = others.length * MIN_UNITS_PER_ASSIGNMENT;
  const distributableUnits = remainingUnits - minimumAllocatedUnits;

  const otherCurrentUnits = others.map((item) =>
    Math.max(0, Math.round(Number(item.weightPercent) * 100) - MIN_UNITS_PER_ASSIGNMENT)
  );
  const currentUnitsTotal = otherCurrentUnits.reduce((sum, value) => sum + value, 0);

  const proportionalBase =
    currentUnitsTotal > 0
      ? otherCurrentUnits.map((value) => (value / currentUnitsTotal) * distributableUnits)
      : Array.from({ length: others.length }, () => distributableUnits / others.length);

  const additionalUnits = proportionalBase.map((value) => Math.floor(value));
  let remainder = distributableUnits - additionalUnits.reduce((sum, value) => sum + value, 0);

  const sortedIndices = proportionalBase
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  let cursor = 0;
  while (remainder > 0) {
    const target = sortedIndices[cursor]?.index ?? 0;
    additionalUnits[target] += 1;
    remainder -= 1;
    cursor = (cursor + 1) % others.length;
  }

  const rebalancedOthers = others.map((item, index) => ({
    id: item.id,
    weightPercent: (MIN_UNITS_PER_ASSIGNMENT + additionalUnits[index]) / 100,
  }));

  return [
    { id: edited.id, weightPercent: editedUnits / 100 },
    ...rebalancedOthers,
  ];
}

export function getAssignmentsWeightPercentTotal(
  assignments: PerformanceCompetencyAssignmentRow[]
): number {
  return assignments.reduce((acc, item) => acc + decimalToPercent(Number(item.item_weight)), 0);
}

export function hasDuplicatedCompetencyIds(assignments: PerformanceCompetencyAssignmentRow[]): boolean {
  const set = new Set<string>();
  for (const item of assignments) {
    if (set.has(item.competency_id)) return true;
    set.add(item.competency_id);
  }
  return false;
}

export function isAssignmentWeightTotalValid(assignments: PerformanceCompetencyAssignmentRow[]): boolean {
  const totalDecimal = assignments.reduce((acc, item) => acc + Number(item.item_weight), 0);
  return Math.abs(totalDecimal - 1) <= WEIGHT_TOLERANCE;
}

export function areAllCatalogCompetenciesRated(params: {
  catalog: EvaluationCompetencyRow[];
  evaluations: PerformanceCompetencyEvaluationRow[];
}): boolean {
  const ratingByCompetency = new Map<string, number | null>();
  for (const item of params.evaluations) {
    ratingByCompetency.set(item.competency_id, item.rating);
  }
  for (const competency of params.catalog) {
    const rating = ratingByCompetency.get(competency.id);
    if (!Number.isInteger(rating) || rating == null || rating < 1 || rating > 3) return false;
  }
  return true;
}
