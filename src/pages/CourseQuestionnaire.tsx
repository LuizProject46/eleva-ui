import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { getAssignment } from '@/services/courseAssignmentService';
import { listRoadmapItems, getQuestionnaireByCourseId, listQuestionnaireQuestionsForAttempt } from '@/services/courseService';
import { getCompletedRoadmapItemIds } from '@/services/courseProgressService';
import { getLatestPassedAttempt } from '@/services/courseQuestionnaireService';
import { QuestionnaireForm } from '@/components/courses/QuestionnaireForm';

export default function CourseQuestionnaire() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [gate, setGate] = useState<'loading' | 'not_found' | 'incomplete' | 'already_passed' | 'ready'>('loading');
  const [assignment, setAssignment] = useState<{ id: string; course_id: string } | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Awaited<ReturnType<typeof getQuestionnaireByCourseId>>>(null);
  const [questions, setQuestions] = useState<Awaited<ReturnType<typeof listQuestionnaireQuestionsForAttempt>>>([]);

  const load = useCallback(async () => {
    if (!assignmentId) {
      setGate('not_found');
      return;
    }
    setIsLoading(true);
    try {
      const a = await getAssignment(assignmentId);
      if (!a) {
        setGate('not_found');
        return;
      }
      setAssignment(a);
      const [items, q] = await Promise.all([
        listRoadmapItems(a.course_id),
        getQuestionnaireByCourseId(a.course_id),
      ]);
      if (!q) {
        setGate('not_found');
        return;
      }
      const completedIds = await getCompletedRoadmapItemIds(a.id);
      const allDone = items.length === 0 || items.every((i) => completedIds.has(i.id));
      if (!allDone) {
        setGate('incomplete');
        return;
      }
      const passed = await getLatestPassedAttempt(a.id);
      if (passed) {
        setGate('already_passed');
        setQuestionnaire(q);
        const qList = await listQuestionnaireQuestionsForAttempt(q.id);
        setQuestions(qList);
        return;
      }
      setQuestionnaire(q);
      const qList = await listQuestionnaireQuestionsForAttempt(q.id);
      setQuestions(qList);
      setGate('ready');
    } catch {
      toast.error('Erro ao carregar questionário.');
      setGate('not_found');
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const goToCourses = () => navigate('/courses');

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </MainLayout>
    );
  }

  if (gate === 'not_found') {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={goToCourses} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar aos cursos
          </Button>
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Atribuição ou questionário não encontrado.
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (gate === 'incomplete') {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={goToCourses} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar aos cursos
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Questionário não disponível</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Conclua todas as etapas da trilha do curso para liberar o questionário final.
              </p>
              <Button className="mt-4" onClick={goToCourses}>
                Voltar ao curso
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (gate === 'already_passed' && questionnaire) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={goToCourses} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar aos cursos
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Questionário final</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-primary">
                Você já foi aprovado neste questionário.
              </p>
              <Button variant="outline" className="mt-4" onClick={goToCourses}>
                Voltar aos cursos
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (gate !== 'ready' || !assignment || !questionnaire) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={goToCourses} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar aos cursos
          </Button>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={goToCourses} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar aos cursos
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Questionário final</CardTitle>
            <CardDescription>
              Responda todas as perguntas. Ao enviar, sua nota será calculada e você precisará atingir a nota mínima para aprovação.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuestionnaireForm
              assignmentId={assignment.id}
              questionnaire={questionnaire}
              questions={questions}
              onSubmitted={goToCourses}
              alreadyPassed={false}
              onBackToCourse={goToCourses}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
