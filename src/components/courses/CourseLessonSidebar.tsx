import { useEffect, useRef } from 'react';
import { CheckCircle2, ChevronRight, ClipboardList } from 'lucide-react';
import type { CourseRoadmapItem } from '@/types/courses';

export const QUESTIONNAIRE_STEP_ID = '__questionnaire__';

interface CourseLessonSidebarProps {
  roadmapItems: CourseRoadmapItem[];
  completedIds: Set<string>;
  selectedStepId: string | null;
  onSelectLesson: (itemId: string) => void;
  progressPercent: number;
  completedCount: number;
  totalSteps: number;
  /** When true, sidebar is rendered inside a Sheet (mobile) */
  isInSheet?: boolean;
  /** When set, a last fixed step "Fazer questionário" is shown. Progress includes this step. */
  hasQuestionnaire?: boolean;
  allStepsCompleted?: boolean;
  quizPassed?: boolean;
  onStartQuestionnaire?: () => void;
}

export function CourseLessonSidebar({
  roadmapItems,
  completedIds,
  selectedStepId,
  onSelectLesson,
  progressPercent,
  completedCount,
  totalSteps,
  isInSheet = false,
  hasQuestionnaire = false,
  allStepsCompleted = false,
  quizPassed = false,
  onStartQuestionnaire,
}: CourseLessonSidebarProps) {
  const activeRowRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!selectedStepId || !activeRowRef.current) return;
    activeRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedStepId]);

  const isQuestionnaireSelected = selectedStepId === QUESTIONNAIRE_STEP_ID;
  const isQuestionnaireDone = hasQuestionnaire && quizPassed;
  const isQuestionnaireClickable = hasQuestionnaire && allStepsCompleted && !quizPassed && onStartQuestionnaire;

  const content = (
    <div className="flex flex-col h-full">
      {(totalSteps > 0 || hasQuestionnaire) && (
        <div className="space-y-2 pb-4 border-b border-border shrink-0">
          <p className="text-sm font-medium text-muted-foreground">Progresso</p>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-sm text-foreground">
            {completedCount} de {totalSteps} concluídas
          </p>
        </div>
      )}

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-4 pb-2">
        Conteúdo do curso
      </p>
      <ul className="space-y-1 overflow-y-auto flex-1 min-h-0" role="list">
        {roadmapItems.map((item) => {
          const isDone = completedIds.has(item.id);
          const isSelected = selectedStepId === item.id;
          return (
            <li key={item.id}>
              <button
                ref={isSelected ? activeRowRef : undefined}
                type="button"
                onClick={() => onSelectLesson(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'bg-accent/10 border-accent/30 text-foreground'
                    : 'bg-card border-border hover:border-muted-foreground/20 hover:bg-muted/30'
                }`}
                aria-current={isSelected ? 'true' : undefined}
              >
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" aria-hidden />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                    {item.position + 1}
                  </span>
                )}
                <span className="flex-1 font-medium truncate text-sm">{item.title}</span>
                <ChevronRight
                  className={`w-4 h-4 shrink-0 text-muted-foreground ${isSelected ? 'opacity-100' : 'opacity-50'}`}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
        {hasQuestionnaire && (
          <li>
            <button
              ref={isQuestionnaireSelected ? activeRowRef : undefined}
              type="button"
              onClick={() => {
                if (isQuestionnaireClickable) onStartQuestionnaire?.();
              }}
              disabled={!isQuestionnaireClickable}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isQuestionnaireClickable
                  ? 'bg-card border-border hover:border-muted-foreground/20 hover:bg-muted/30 cursor-pointer'
                  : isQuestionnaireDone
                    ? 'bg-card border-border cursor-default'
                    : 'bg-muted/20 border-border opacity-70 cursor-not-allowed'
              }`}
              aria-current={isQuestionnaireSelected ? 'true' : undefined}
            >
              {isQuestionnaireDone ? (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" aria-hidden />
              ) : (
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <ClipboardList className="w-3 h-3 text-muted-foreground" />
                </span>
              )}
              <span className="flex-1 font-medium truncate text-sm">Fazer questionário</span>
              {isQuestionnaireClickable && (
                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </button>
          </li>
        )}
      </ul>
    </div>
  );

  if (isInSheet) {
    return <div className="p-4">{content}</div>;
  }

  return (
    <aside
      className="flex flex-col w-full min-w-0 bg-card border border-border rounded-lg overflow-hidden h-fit lg:sticky lg:top-4"
      aria-label="Lista de aulas"
    >
      <div className="p-4 flex flex-col max-h-[calc(100vh-8rem)] min-h-0">
        {content}
      </div>
    </aside>
  );
}
