import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  createQuestionnaire,
  updateQuestionnaire,
  createQuestionnaireQuestion,
  updateQuestionnaireQuestion,
  deleteQuestionnaireQuestion,
} from '@/services/courseService';
import type { CourseQuestionnaire, QuestionnaireQuestion } from '@/types/courses';
import type { QuestionnaireQuestionType } from '@/types/courses';

interface QuestionnaireEditorProps {
  courseId: string;
  questionnaire: CourseQuestionnaire | null;
  questions: QuestionnaireQuestion[];
  onUpdate: () => void;
}

export function QuestionnaireEditor({
  courseId,
  questionnaire,
  questions,
  onUpdate,
}: QuestionnaireEditorProps) {
  const [passingScore, setPassingScore] = useState(questionnaire?.passing_score ?? 70);
  const [savingQuestionnaire, setSavingQuestionnaire] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<QuestionnaireQuestionType>('single_choice');
  const [newOptions, setNewOptions] = useState('');
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);
  const [newCorrectIndices, setNewCorrectIndices] = useState<number[]>([]);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editQuestionType, setEditQuestionType] = useState<QuestionnaireQuestionType>('single_choice');
  const [editOptions, setEditOptions] = useState('');
  const [editCorrectIndex, setEditCorrectIndex] = useState(0);
  const [editCorrectIndices, setEditCorrectIndices] = useState<number[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const ensureQuestionnaire = async (): Promise<CourseQuestionnaire> => {
    if (questionnaire) return questionnaire;
    const q = await createQuestionnaire({
      course_id: courseId,
      title: 'Questionário final',
      passing_score: 70,
    });
    onUpdate();
    return q;
  };

  const handleSavePassingScore = async () => {
    if (!questionnaire) {
      const q = await ensureQuestionnaire();
      await updateQuestionnaire(q.id, { passing_score: passingScore });
    } else {
      setSavingQuestionnaire(true);
      try {
        await updateQuestionnaire(questionnaire.id, { passing_score: passingScore });
        toast.success('Nota mínima atualizada.');
      } catch {
        toast.error('Erro ao salvar.');
      } finally {
        setSavingQuestionnaire(false);
      }
    }
    onUpdate();
  };

  const handleAddQuestion = async () => {
    const q = await ensureQuestionnaire();
    const opts = newOptions.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!newQuestionText.trim() || opts.length < 2) {
      toast.error('Informe o enunciado e pelo menos duas opções (uma por linha).');
      return;
    }
    if (newQuestionType === 'single_choice') {
      const correctAnswer = opts[newCorrectIndex];
      try {
        await createQuestionnaireQuestion({
          questionnaire_id: q.id,
          position: questions.length,
          question_text: newQuestionText.trim(),
          question_type: 'single_choice',
          options: opts,
          correct_answer: correctAnswer,
        });
        toast.success('Pergunta adicionada.');
        setNewQuestionText('');
        setNewOptions('');
        setNewCorrectIndex(0);
        setAddingQuestion(false);
        onUpdate();
      } catch {
        toast.error('Erro ao adicionar pergunta.');
      }
      return;
    }
    const correctOptions = newCorrectIndices
      .filter((i) => i >= 0 && i < opts.length)
      .map((i) => opts[i]);
    if (correctOptions.length === 0) {
      toast.error('Marque pelo menos uma opção como correta.');
      return;
    }
    try {
      await createQuestionnaireQuestion({
        questionnaire_id: q.id,
        position: questions.length,
        question_text: newQuestionText.trim(),
        question_type: 'multiple_choice',
        options: opts,
        correct_answer: correctOptions,
      });
      toast.success('Pergunta adicionada.');
      setNewQuestionText('');
      setNewOptions('');
      setNewCorrectIndices([]);
      setAddingQuestion(false);
      onUpdate();
    } catch {
      toast.error('Erro ao adicionar pergunta.');
    }
  };

  const handleDeleteQuestion = async (question: QuestionnaireQuestion) => {
    try {
      await deleteQuestionnaireQuestion(question.id);
      toast.success('Pergunta removida.');
      setExpandedQuestionId((id) => (id === question.id ? null : id));
      setEditingQuestionId((id) => (id === question.id ? null : id));
      onUpdate();
    } catch {
      toast.error('Erro ao remover.');
    }
  };

  function getCorrectAnswerLabel(question: QuestionnaireQuestion): string {
    const ca = question.correct_answer;
    if (question.question_type === 'single_choice') {
      const single = Array.isArray(ca) ? ca[0] : ca;
      return single != null ? String(single) : '—';
    }
    const arr = Array.isArray(ca) ? ca.map(String) : [];
    return arr.length > 0 ? arr.join(', ') : '—';
  }

  const openEdit = (question: QuestionnaireQuestion) => {
    setEditingQuestionId(question.id);
    setEditQuestionText(question.question_text);
    setEditQuestionType(question.question_type);
    setEditOptions(question.options.join('\n'));
    const ca = question.correct_answer;
    if (question.question_type === 'single_choice') {
      const single = Array.isArray(ca) ? ca[0] : ca;
      const idx = question.options.findIndex((o) => String(o) === String(single));
      setEditCorrectIndex(idx >= 0 ? idx : 0);
      setEditCorrectIndices([]);
    } else {
      const correctSet = new Set(Array.isArray(ca) ? ca.map(String) : []);
      setEditCorrectIndex(0);
      setEditCorrectIndices(
        question.options.map((_, i) => i).filter((i) => correctSet.has(question.options[i]))
      );
    }
    setAddingQuestion(false);
  };

  const cancelEdit = () => {
    setEditingQuestionId(null);
    setEditQuestionText('');
    setEditOptions('');
    setEditCorrectIndex(0);
    setEditCorrectIndices([]);
  };

  const handleSaveEdit = async () => {
    if (!editingQuestionId) return;
    const opts = editOptions.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!editQuestionText.trim() || opts.length < 2) {
      toast.error('Informe o enunciado e pelo menos duas opções (uma por linha).');
      return;
    }
    if (editQuestionType === 'multiple_choice') {
      const correctOptions = editCorrectIndices
        .filter((i) => i >= 0 && i < opts.length)
        .map((i) => opts[i]);
      if (correctOptions.length === 0) {
        toast.error('Marque pelo menos uma opção como correta.');
        return;
      }
    }
    setSavingEdit(true);
    try {
      if (editQuestionType === 'single_choice') {
        const singleIndex = Math.min(editCorrectIndex, opts.length - 1);
        await updateQuestionnaireQuestion(editingQuestionId, {
          question_text: editQuestionText.trim(),
          question_type: 'single_choice',
          options: opts,
          correct_answer: opts[singleIndex],
        });
      } else {
        const correctOptions = editCorrectIndices
          .filter((i) => i >= 0 && i < opts.length)
          .map((i) => opts[i]);
        await updateQuestionnaireQuestion(editingQuestionId, {
          question_text: editQuestionText.trim(),
          question_type: 'multiple_choice',
          options: opts,
          correct_answer: correctOptions,
        });
      }
      toast.success('Pergunta atualizada.');
      cancelEdit();
      onUpdate();
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setSavingEdit(false);
    }
  };

  const optionsForNew = newOptions.split('\n').map((s) => s.trim()).filter(Boolean);
  const optionsForEdit = editOptions.split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Questionário final</CardTitle>
        <CardDescription>
          Perguntas exibidas ao final do curso. O colaborador precisa atingir a nota mínima para concluir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Nota mínima para aprovação (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value) || 0)}
              className="w-24"
            />
          </div>
          <Button onClick={handleSavePassingScore} disabled={savingQuestionnaire}>
            {savingQuestionnaire ? 'Salvando...' : 'Salvar nota mínima'}
          </Button>
        </div>

        <div>
          <Label className="text-base font-medium">Perguntas</Label>
          <ul className="mt-2 space-y-3">
            {questions.map((q, idx) => (
              <li key={q.id} className="rounded-lg border bg-card overflow-hidden">
                <Collapsible
                  open={expandedQuestionId === q.id}
                  onOpenChange={(open) => setExpandedQuestionId(open ? q.id : null)}
                >
                  <div className="flex items-start gap-2 p-3">
                    <span className="text-sm font-medium text-muted-foreground shrink-0">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{q.question_text}</p>
                      <p className="text-sm text-muted-foreground">
                        {q.question_type === 'single_choice' ? 'Única escolha' : 'Múltipla escolha'} — {q.options.length} opções
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" className="gap-1">
                          {expandedQuestionId === q.id ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              Ocultar
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              Ver respostas
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => openEdit(q)}
                        aria-label="Editar pergunta"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteQuestion(q)}
                        aria-label="Excluir pergunta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="border-t bg-muted/30 px-3 py-3 pl-9 space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Opções</p>
                      <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
                        {q.options.map((opt, i) => (
                          <li key={i}>{opt}</li>
                        ))}
                      </ol>
                      <p className="text-sm font-medium text-muted-foreground pt-1">
                        Resposta(s) correta(s): <span className="text-foreground font-normal">{getCorrectAnswerLabel(q)}</span>
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            ))}
          </ul>
        </div>

        {!addingQuestion && !editingQuestionId && (
          <Button variant="outline" onClick={() => setAddingQuestion(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Adicionar pergunta
          </Button>
        )}

        {editingQuestionId && (
          <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Editar pergunta</p>
            <div className="space-y-2">
              <Label>Enunciado</Label>
              <Input
                value={editQuestionText}
                onChange={(e) => setEditQuestionText(e.target.value)}
                placeholder="Ex: Qual a resposta correta?"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={editQuestionType}
                onValueChange={(v) => {
                  setEditQuestionType(v as QuestionnaireQuestionType);
                  setEditCorrectIndex(0);
                  setEditCorrectIndices([]);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_choice">Única escolha</SelectItem>
                  <SelectItem value="multiple_choice">Múltipla escolha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Opções (uma por linha)</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={editOptions}
                onChange={(e) => setEditOptions(e.target.value)}
                placeholder="Opção A&#10;Opção B&#10;Opção C"
              />
            </div>
            {optionsForEdit.length >= 2 && editQuestionType === 'single_choice' && (
              <div className="space-y-2">
                <Label>Resposta correta</Label>
                <Select
                  value={String(Math.min(editCorrectIndex, optionsForEdit.length - 1))}
                  onValueChange={(v) => setEditCorrectIndex(Number(v))}
                >
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {optionsForEdit.map((_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i + 1}. {optionsForEdit[i]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {optionsForEdit.length >= 2 && editQuestionType === 'multiple_choice' && (
              <div className="space-y-2">
                <Label>Opções corretas (marque todas que aplicam)</Label>
                <div className="flex flex-col gap-2 rounded-md border border-input p-3">
                  {optionsForEdit.map((opt, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-correct-${i}`}
                        checked={editCorrectIndices.includes(i)}
                        onCheckedChange={(checked) => {
                          setEditCorrectIndices((prev) =>
                            checked ? [...prev, i].sort((a, b) => a - b) : prev.filter((j) => j !== i)
                          );
                        }}
                      />
                      <Label htmlFor={`edit-correct-${i}`} className="font-normal cursor-pointer flex-1">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? 'Salvando...' : 'Salvar alterações'}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEdit} disabled={savingEdit}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {addingQuestion && (
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <Label>Enunciado</Label>
            <Input
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              placeholder="Ex: Qual a resposta correta?"
            />
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={newQuestionType}
                onValueChange={(v) => {
                  setNewQuestionType(v as QuestionnaireQuestionType);
                  setNewCorrectIndex(0);
                  setNewCorrectIndices([]);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_choice">Única escolha</SelectItem>
                  <SelectItem value="multiple_choice">Múltipla escolha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Opções (uma por linha)</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
                placeholder="Opção A&#10;Opção B&#10;Opção C"
              />
            </div>
            {optionsForNew.length >= 2 && newQuestionType === 'single_choice' && (
              <div className="space-y-2">
                <Label>Resposta correta</Label>
                <Select value={String(newCorrectIndex)} onValueChange={(v) => setNewCorrectIndex(Number(v))}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {optionsForNew.map((_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i + 1}. {optionsForNew[i]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {optionsForNew.length >= 2 && newQuestionType === 'multiple_choice' && (
              <div className="space-y-2">
                <Label>Opções corretas (marque todas que aplicam)</Label>
                <div className="flex flex-col gap-2 rounded-md border border-input p-3">
                  {optionsForNew.map((opt, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <Checkbox
                        id={`correct-${i}`}
                        checked={newCorrectIndices.includes(i)}
                        onCheckedChange={(checked) => {
                          setNewCorrectIndices((prev) =>
                            checked ? [...prev, i].sort((a, b) => a - b) : prev.filter((j) => j !== i)
                          );
                        }}
                      />
                      <Label htmlFor={`correct-${i}`} className="font-normal cursor-pointer flex-1">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleAddQuestion}>Adicionar</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAddingQuestion(false);
                  setNewCorrectIndices([]);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
