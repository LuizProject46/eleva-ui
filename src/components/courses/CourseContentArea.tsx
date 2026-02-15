import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { RoadmapStepViewer } from './RoadmapStepViewer';
import type { Course, CourseRoadmapItem } from '@/types/courses';

interface CourseContentAreaProps {
  course: Course;
  currentItem: CourseRoadmapItem | null;
  prevItem: CourseRoadmapItem | null;
  nextItem: CourseRoadmapItem | null;
  canCompleteCurrent: boolean;
  onSelectStep: (itemId: string) => void;
  onCompleteStep: (item: CourseRoadmapItem) => Promise<void>;
  completingId: string | null;
  courseId: string;
  onBack: () => void;
}

export function CourseContentArea({
  course,
  currentItem,
  prevItem,
  nextItem,
  canCompleteCurrent,
  onSelectStep,
  onCompleteStep,
  completingId,
  courseId,
  onBack,
}: CourseContentAreaProps) {

  return (
    <div className="flex flex-col min-w-0 flex-1 space-y-4 animate-fade-in">
      <Button variant="ghost" onClick={onBack} className="gap-2 w-fit">
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </Button>

      {!currentItem ? (
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-muted-foreground">
          Selecione uma aula na lista ao lado para começar.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
              <RoadmapStepViewer
                item={currentItem}
                courseId={courseId}
                tenantId={course.tenant_id}
              />
            </div>
            <div className="text-xl space-y-2">
              <span className="font-medium">Resumo do curso:</span>
              <p className="text-sm text-muted-foreground">
                {course.description || 'Sem descrição'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
            <div className="flex gap-2">
              {prevItem && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectStep(prevItem.id)}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
              )}
              {nextItem && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectStep(nextItem.id)}
                  className="gap-1"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
            {canCompleteCurrent && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onCompleteStep(currentItem)}
                  disabled={completingId === currentItem.id}
                >
                  {completingId === currentItem.id ? 'Salvando...' : 'Marcar como concluído'}
                </Button>
                {nextItem && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      await onCompleteStep(currentItem);
                      onSelectStep(nextItem.id);
                    }}
                    disabled={completingId === currentItem.id}
                  >
                    Marcar e ir para próxima
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
