import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { List, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCourse,
  listRoadmapItems,
  getQuestionnaireByCourseId,
  listQuestionnaireQuestions,
} from '@/services/courseService';
import {
  getCompletedRoadmapItemIds,
  completeRoadmapItem,
  canCompleteStep,
  isCourseCompleted,
} from '@/services/courseProgressService';
import { getLatestPassedAttempt } from '@/services/courseQuestionnaireService';
import type { Course, CourseRoadmapItem, CourseQuestionnaire, QuestionnaireQuestion } from '@/types/courses';
import { CourseContentArea } from './CourseContentArea';
import { CourseLessonSidebar } from './CourseLessonSidebar';

interface CourseDetailProps {
  assignmentId: string;
  courseId: string;
  onBack: () => void;
  onProgress: () => void;
}

export function CourseDetail({ assignmentId, courseId, onBack, onProgress }: CourseDetailProps) {
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [roadmapItems, setRoadmapItems] = useState<CourseRoadmapItem[]>([]);
  const [questionnaire, setQuestionnaire] = useState<CourseQuestionnaire | null>(null);
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [quizPassed, setQuizPassed] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lessonListSheetOpen, setLessonListSheetOpen] = useState(false);

  const load = useCallback(async () => {
    const [c, items, q] = await Promise.all([
      getCourse(courseId),
      listRoadmapItems(courseId),
      getQuestionnaireByCourseId(courseId),
    ]);
    setCourse(c ?? null);
    setRoadmapItems(items);
    setQuestionnaire(q ?? null);
    if (q) {
      const qList = await listQuestionnaireQuestions(q.id);
      setQuestions(qList);
    } else {
      setQuestions([]);
    }
    const ids = await getCompletedRoadmapItemIds(assignmentId);
    setCompletedIds(ids);
    const passed = await getLatestPassedAttempt(assignmentId);
    setQuizPassed(!!passed);
    const completed = await isCourseCompleted(assignmentId);
    setIsCompleted(completed);
  }, [courseId, assignmentId]);

  useEffect(() => {
    load().finally(() => setIsLoading(false));
  }, [load]);

  useEffect(() => {
    if (roadmapItems.length > 0 && selectedStepId === null) {
      setSelectedStepId(roadmapItems[0].id);
    }
  }, [roadmapItems, selectedStepId]);

  const handleCompleteStep = async (item: CourseRoadmapItem) => {
    const prevItem = roadmapItems[item.position - 1] ?? null;
    const prevId = prevItem?.id ?? null;
    const can = await canCompleteStep(assignmentId, item.id, prevId);
    if (!can) {
      toast.error('Conclua a etapa anterior primeiro.');
      return;
    }
    setCompletingId(item.id);
    try {
      await completeRoadmapItem(assignmentId, item.id);
      setCompletedIds((prev) => new Set([...prev, item.id]));
      onProgress();
      const nextItem = roadmapItems[item.position];
      if (nextItem) setSelectedStepId(nextItem.id);
    } catch {
      toast.error('Erro ao marcar etapa.');
    } finally {
      setCompletingId(null);
    }
  };

  const goToQuestionnaire = () => {
    navigate(`/courses/assignment/${assignmentId}/questionnaire`);
  };

  if (isLoading || !course) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          Voltar
        </Button>
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  const completedCount = roadmapItems.filter((i) => completedIds.has(i.id)).length;
  const totalSteps = roadmapItems.length;
  const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  const allStepsCompleted = totalSteps === 0 || roadmapItems.every((i) => completedIds.has(i.id));
  const canAccessQuiz = allStepsCompleted && questionnaire;

  const currentStepIndex = selectedStepId
    ? roadmapItems.findIndex((i) => i.id === selectedStepId)
    : -1;
  const currentItem = currentStepIndex >= 0 ? roadmapItems[currentStepIndex] : null;
  const prevItem = currentStepIndex > 0 ? roadmapItems[currentStepIndex - 1] : null;
  const nextItem =
    currentStepIndex >= 0 && currentStepIndex < roadmapItems.length - 1
      ? roadmapItems[currentStepIndex + 1]
      : null;
  const prevForCurrent = currentItem ? roadmapItems[currentItem.position - 1] : null;
  const canCompleteCurrent =
    currentItem &&
    !completedIds.has(currentItem.id) &&
    (prevForCurrent ? completedIds.has(prevForCurrent.id) : true);

  const sidebarContent = (
    <CourseLessonSidebar
      roadmapItems={roadmapItems}
      completedIds={completedIds}
      selectedStepId={selectedStepId}
      onSelectLesson={(id) => {
        setSelectedStepId(id);
        setLessonListSheetOpen(false);
      }}
      progressPercent={progressPercent}
      completedCount={completedCount}
      totalSteps={totalSteps}
      isInSheet={false}
    />
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground truncate">
          {course.title}
          {isCompleted && (
            <span className="ml-2 font-medium text-primary">· Concluído</span>
          )}
        </p>
        <Sheet open={lessonListSheetOpen} onOpenChange={setLessonListSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 lg:hidden">
              <List className="w-4 h-4" />
              Aulas
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-sm">
            <SheetHeader className="p-4 border-b border-border">
              <SheetTitle>Conteúdo do curso</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <CourseLessonSidebar
                roadmapItems={roadmapItems}
                completedIds={completedIds}
                selectedStepId={selectedStepId}
                onSelectLesson={(id) => {
                  setSelectedStepId(id);
                  setLessonListSheetOpen(false);
                }}
                progressPercent={progressPercent}
                completedCount={completedCount}
                totalSteps={totalSteps}
                isInSheet
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {roadmapItems.length > 0 ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <main className="min-w-0 flex-1">
            <CourseContentArea
              course={course}
              currentItem={currentItem}
              prevItem={prevItem}
              nextItem={nextItem}
              canCompleteCurrent={canCompleteCurrent}
              onSelectStep={setSelectedStepId}
              onCompleteStep={handleCompleteStep}
              completingId={completingId}
              courseId={courseId}
              onBack={onBack}
            />
          </main>

          <div
            className={`w-80 shrink-0 hidden lg:block ${sidebarOpen ? 'md:block' : ''}`}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between lg:hidden">
                <span className="text-sm font-medium text-foreground">Aulas</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Fechar lista de aulas"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {sidebarContent}
            </div>
          </div>

          {!sidebarOpen && (
            <div className="fixed bottom-4 right-4 z-40 hidden md:flex lg:hidden">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="gap-2 shadow-lg"
              >
                <List className="w-4 h-4" />
                Ver aulas
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {questionnaire && (
        <Card>
          <CardHeader>
            <CardTitle>Questionário final</CardTitle>
          </CardHeader>
          <CardContent>
            {!allStepsCompleted && (
              <p className="text-muted-foreground text-sm mb-4">
                Conclua todas as etapas da trilha para liberar o questionário.
              </p>
            )}
            {canAccessQuiz && !quizPassed && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Curso concluído. Realize o questionário final para validar seu aprendizado.
                </p>
                <Button onClick={goToQuestionnaire}>Iniciar questionário</Button>
              </div>
            )}
            {canAccessQuiz && quizPassed && (
              <p className="text-sm font-medium text-primary">
                Você já foi aprovado neste questionário.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {roadmapItems.length === 0 && !questionnaire && (
        <p className="text-muted-foreground">
          Este curso ainda não possui conteúdo configurado.
        </p>
      )}
    </div>
  );
}
