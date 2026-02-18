import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { submitAttempt } from '@/services/courseQuestionnaireService';
import { generateCertificateIfEligible } from '@/services/certificateService';
import type { CourseQuestionnaire, QuestionnaireQuestionForAttempt } from '@/types/courses';

interface QuestionnaireFormProps {
  assignmentId: string;
  questionnaire: CourseQuestionnaire;
  questions: QuestionnaireQuestionForAttempt[];
  onSubmitted: () => void;
  alreadyPassed: boolean;
  /** Called from failure screen for "Voltar ao curso" */
  onBackToCourse?: () => void;
}

function getAnsweredCount(
  questions: QuestionnaireQuestionForAttempt[],
  answers: Record<string, string | string[]>
): number {
  return questions.filter((q) => {
    const a = answers[q.id];
    if (q.question_type === 'multiple_choice') {
      return Array.isArray(a) && a.length > 0;
    }
    return typeof a === 'string' && a.trim() !== '';
  }).length;
}

export function QuestionnaireForm({
  assignmentId,
  questionnaire,
  questions,
  onSubmitted,
  alreadyPassed,
  onBackToCourse,
}: QuestionnaireFormProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);

  const answeredCount = getAnsweredCount(questions, answers);
  const totalCount = questions.length;
  const allAnswered = totalCount > 0 && answeredCount === totalCount;

  const handleSingleChoice = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleMultipleChoice = (questionId: string, optionText: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = (prev[questionId] as string[] | undefined) ?? [];
      const next = checked
        ? [...current, optionText]
        : current.filter((item) => item !== optionText);
      return { ...prev, [questionId]: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAnswered) {
      toast.error('Responda todas as perguntas antes de enviar.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { score, passed } = await submitAttempt({
        assignmentId,
        questionnaireId: questionnaire.id,
        answers,
      });
      setResult({ score, passed });
      if (passed) {
        toast.success(`Aprovado! Sua nota: ${score}%.`);
        try {
          await generateCertificateIfEligible(assignmentId);
        } catch {
          // Certificate generation is best-effort; do not block success UX
        }

      }
    } catch {
      toast.error('Erro ao enviar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (alreadyPassed && !result) {
    return (
      <p className="text-sm text-muted-foreground">
        Você já foi aprovado neste questionário.
      </p>
    );
  }

  if (result?.passed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/5 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-600" aria-hidden />
        <p className="text-sm font-medium text-foreground">
          Questionário aprovado. Nota: {result.score}%.
        </p>
        <Button variant="outline" onClick={onSubmitted}>
          Voltar aos cursos
        </Button>
      </div>
    );
  }

  if (result && !result.passed) {
    const minScore = questionnaire.passing_score ?? 70;
    return (
      <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Questionário não atingiu a nota mínima</AlertTitle>
        <AlertDescription asChild>
          <div className="mt-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              Sua nota: <strong>{result.score}%</strong>. Nota mínima: <strong>{minScore}%</strong>.
              Você pode revisar o conteúdo do curso e tentar novamente.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                }}
              >
                Tentar novamente
              </Button>
              {onBackToCourse && (
                <Button type="button" variant="outline" onClick={onBackToCourse}>
                  Voltar ao curso
                </Button>
              )}
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (questions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma pergunta configurada ainda.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        <span>
          Perguntas respondidas: <strong className="text-foreground">{answeredCount}</strong> de{' '}
          <strong className="text-foreground">{totalCount}</strong>
        </span>
        {allAnswered && (
          <span className="text-green-600 font-medium">Pronto para enviar</span>
        )}
      </div>

      <ol className="space-y-6 list-none">
        {questions.map((q, idx) => {
          const singleValue = (answers[q.id] as string | undefined) ?? '';
          const multipleValues = (answers[q.id] as string[] | undefined) ?? [];
          const isSingle = q.question_type === 'single_choice';

          return (
            <li
              key={q.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md md:p-5"
            >
              <div className="space-y-3">
                <div className="flex gap-2">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary"
                    aria-hidden
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Label className="text-base font-medium leading-tight">
                      {q.question_text}
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isSingle ? 'Escolha uma opção' : 'Marque todas que se aplicam'}
                    </p>
                  </div>
                </div>

                {isSingle ? (
                  <RadioGroup
                    value={singleValue}
                    onValueChange={(v) => handleSingleChoice(q.id, v)}
                    className="flex flex-col gap-2 pt-1"
                    name={`q-${q.id}`}
                  >
                    {q.options.map((opt, i) => (
                      <label
                        key={`${q.id}-${i}`}
                        htmlFor={`${q.id}-${i}`}
                        className="flex cursor-pointer items-center gap-3 rounded-md border border-transparent px-3 py-2.5 transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
                      >
                        <RadioGroupItem value={opt} id={`${q.id}-${i}`} />
                        <span className="text-sm font-normal">{opt}</span>
                      </label>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="flex flex-col gap-2 pt-1" role="group" aria-label={`Opções para pergunta ${idx + 1}`}>
                    {q.options.map((opt, i) => (
                      <label
                        key={`${q.id}-${i}`}
                        htmlFor={`${q.id}-${i}`}
                        className="flex cursor-pointer items-center gap-3 rounded-md border border-transparent px-3 py-2.5 transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
                      >
                        <Checkbox
                          id={`${q.id}-${i}`}
                          checked={multipleValues.includes(opt)}
                          onCheckedChange={(checked) =>
                            handleMultipleChoice(q.id, opt, checked === true)
                          }
                        />
                        <span className="text-sm font-normal">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {allAnswered
            ? 'Revise suas respostas e envie quando estiver pronto.'
            : 'Responda todas as perguntas para habilitar o envio.'}
        </p>
        <Button type="submit" disabled={!allAnswered || isSubmitting} className="sm:shrink-0">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Enviando...
            </>
          ) : (
            'Enviar questionário'
          )}
        </Button>
      </div>
    </form>
  );
}
