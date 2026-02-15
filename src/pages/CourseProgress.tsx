import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { List } from 'lucide-react';
import { toast } from 'sonner';
import { getAssignment } from '@/services/courseAssignmentService';
import { getCourse, listRoadmapItems } from '@/services/courseService';
import {
  getCompletedRoadmapItemIds,
  completeRoadmapItem,
  canCompleteStep,
} from '@/services/courseProgressService';
import { getLatestPassedAttempt } from '@/services/courseQuestionnaireService';
import type { Course, CourseRoadmapItem } from '@/types/courses';
import { CourseContentArea } from '@/components/courses/CourseContentArea';
import { CourseLessonSidebar } from '@/components/courses/CourseLessonSidebar';

export default function CourseProgress() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [roadmapItems, setRoadmapItems] = useState<CourseRoadmapItem[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [lessonListSheetOpen, setLessonListSheetOpen] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);

  const load = useCallback(async () => {
    if (!assignmentId) return;
    setIsLoading(true);
    try {
      const a = await getAssignment(assignmentId);
      if (!a) {
        toast.error('Atribuição não encontrada.');
        navigate('/courses', { replace: true });
        return;
      }
      const [c, items] = await Promise.all([
        getCourse(a.course_id),
        listRoadmapItems(a.course_id),
      ]);
      if (!c) {
        toast.error('Curso não encontrado.');
        navigate('/courses', { replace: true });
        return;
      }
      setCourse(c);
      setRoadmapItems(items);
      const ids = await getCompletedRoadmapItemIds(assignmentId);
      setCompletedIds(ids);
      const passed = await getLatestPassedAttempt(assignmentId);
      setQuizPassed(!!passed);
    } catch {
      toast.error('Erro ao carregar curso.');
      navigate('/courses', { replace: true });
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (roadmapItems.length > 0 && selectedStepId === null) {
      setSelectedStepId(roadmapItems[0].id);
    }
  }, [roadmapItems, selectedStepId]);

  const handleCompleteStep = async (item: CourseRoadmapItem) => {
    if (!assignmentId) return;
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
      const nextItem = roadmapItems[item.position];
      if (nextItem) setSelectedStepId(nextItem.id);
    } catch {
      toast.error('Erro ao marcar etapa.');
    } finally {
      setCompletingId(null);
    }
  };

  const goBack = () => navigate('/courses');

  if (isLoading || !course) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-[60vh] w-full rounded-lg" />
        </div>
      </MainLayout>
    );
  }

  const completedCount = roadmapItems.filter((i) => completedIds.has(i.id)).length;
  const totalSteps = roadmapItems.length;
  const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

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
  const allStepsCompleted = totalSteps === 0 || roadmapItems.every((i) => completedIds.has(i.id));
  const goToQuestionnaire = () => navigate(`/courses/assignment/${assignmentId}/questionnaire`);
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
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-muted-foreground truncate">{course.title}</h2>
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
                onSelectStep={(id) => setSelectedStepId(id)}
                onCompleteStep={handleCompleteStep}
                completingId={completingId}
                courseId={course.id}
                onBack={goBack}
              />
            </main>

            <aside className="w-80 shrink-0 hidden lg:block">
              {sidebarContent}
            </aside>
          </div>
        ) : null}

        {roadmapItems.length > 0 && allStepsCompleted && assignmentId && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Todas as etapas concluídas.
              {!quizPassed && ' Realize o questionário final para validar seu aprendizado.'}
            </p>
            {!quizPassed && (
              <Button onClick={goToQuestionnaire}>Iniciar questionário</Button>
            )}
          </div>
        )}

        {roadmapItems.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-muted-foreground">
            Este curso ainda não possui etapas. Volte à lista de cursos.
            <Button variant="outline" className="mt-4" onClick={goBack}>
              Voltar aos cursos
            </Button>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}
