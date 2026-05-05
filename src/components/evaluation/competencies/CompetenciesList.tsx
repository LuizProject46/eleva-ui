import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { PerformanceCompetencyAssignmentRow } from '@/types/performanceCompetency';

export interface AssignmentWithCompetency extends PerformanceCompetencyAssignmentRow {
  competencyName: string;
  competencyDescription: string;
}

interface CompetenciesListProps {
  assignments: AssignmentWithCompetency[];
  isLoading: boolean;
  canManage: boolean;
  onEdit: (assignment: AssignmentWithCompetency) => void;
}

export function CompetenciesList({
  assignments,
  isLoading,
  canManage,
  onEdit,
}: CompetenciesListProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <span className="text-sm rounded-md border border-border bg-muted/40 text-muted-foreground px-3 py-1">
              Competências atribuídas: <span className="font-medium text-foreground">{assignments.length}/5</span>
            </span>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            {canManage
              ? 'Nenhuma competência atribuída. Selecione competências do catálogo (até cinco).'
              : 'Nenhuma competência atribuída para você ainda.'}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {assignments.map((assignment, index) => (
            <li key={assignment.id}>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base font-semibold leading-snug">
                      <span className="text-muted-foreground font-normal mr-2">{index + 1}.</span>
                      {assignment.competencyName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">{assignment.competencyDescription}</p>
                    {canManage ? (
                      <p className="text-xs text-muted-foreground mt-2">
                        Peso nesta avaliação:{' '}
                        <span className="font-medium text-foreground">
                          {(Number(assignment.item_weight) * 100).toFixed(2)}%
                        </span>
                      </p>
                    ) : null}
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => onEdit(assignment)}
                        aria-label="Editar competência"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : null}
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
