import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCompetencyCycles,
  useCompetencyItems,
  useMyCompetencyEvaluations,
  useCompetencyEvaluation,
  useCreateOrUpdateCompetencyEvaluation,
} from '@/hooks/useCompetency';
import { useEmployeesForAssign } from '@/hooks/useOnboarding';
import {
  Star,
  TrendingUp,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

const StarRating = ({
  score,
  maxScore = 5,
  size = 'md',
  interactive = false,
  onChange,
}: {
  score: number | null;
  maxScore?: number;
  size?: 'sm' | 'md';
  interactive?: boolean;
  onChange?: (score: number) => void;
}) => {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className="flex gap-1">
      {Array.from({ length: maxScore }).map((_, i) => (
        <button
          key={i}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(i + 1)}
          className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
        >
          <Star
            className={`${sizeClass} ${
              score !== null && i < score ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

export default function CompetencyEvaluation() {
  const { canManageUsers } = useAuth();
  const isTeamView = canManageUsers();
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedbackPerCompetency, setFeedbackPerCompetency] = useState<Record<string, string>>({});
  const [feedbackGlobal, setFeedbackGlobal] = useState('');
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null);

  const { data: cycles } = useCompetencyCycles();
  const { data: items } = useCompetencyItems(selectedCycleId || (cycles?.[0]?.id ?? null));
  const { data: myEvaluations, isLoading: evalsLoading } = useMyCompetencyEvaluations(
    isTeamView ? (selectedProfileId || undefined) : undefined,
    { enabled: !isTeamView || !!selectedProfileId }
  );
  const { data: evalDetail } = useCompetencyEvaluation(selectedEvalId);
  const { data: employees } = useEmployeesForAssign();
  const saveMutation = useCreateOrUpdateCompetencyEvaluation();

  const activeCycleId = selectedCycleId || cycles?.[0]?.id || '';
  const profileIdToUse = isTeamView ? selectedProfileId : undefined;

  const handleScoreChange = (competencyId: string, score: number) => {
    setScores((prev) => ({ ...prev, [competencyId]: score }));
  };

  const handleFeedbackChange = (competencyId: string, feedback: string) => {
    setFeedbackPerCompetency((prev) => ({ ...prev, [competencyId]: feedback }));
  };

  const handleSubmit = () => {
    if (!selectedProfileId) {
      toast.error('Selecione um colaborador');
      return;
    }
    if (!activeCycleId) {
      toast.error('Selecione um ciclo');
      return;
    }
    const scoreEntries = (items ?? [])
      .map((item) => ({
        competency_item_id: item.id,
        score: scores[item.id] ?? 0,
        feedback: feedbackPerCompetency[item.id] ?? undefined,
      }))
      .filter((s) => s.score > 0);
    if (scoreEntries.length === 0) {
      toast.error('Preencha ao menos uma competência');
      return;
    }
    saveMutation.mutate(
      {
        profileId: selectedProfileId,
        cycleId: activeCycleId,
        scores: scoreEntries,
        feedbackGlobal: feedbackGlobal || undefined,
        status: 'completed',
      },
      {
        onSuccess: () => {
          toast.success('Avaliação salva com sucesso');
          setSelectedEvalId(null);
          setScores({});
          setFeedbackPerCompetency({});
          setFeedbackGlobal('');
        },
        onError: () => toast.error('Erro ao salvar avaliação'),
      }
    );
  };

  const evaluations = myEvaluations ?? [];
  const selectedEval = evalDetail ?? null;

  if (!isTeamView) {
    return (
      <MainLayout>
        <div className="space-y-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Avaliações de Competências
            </h1>
            <p className="text-muted-foreground mt-1">
              Acompanhe suas avaliações semestrais de competências
            </p>
          </div>

          {evalsLoading ? (
            <div className="card-elevated p-12 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : evaluations.length === 0 ? (
            <div className="card-elevated p-12 text-center text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma avaliação de competências encontrada</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Histórico
              </h2>
              {evaluations.map((e: { id: string; competency_cycles?: { name: string }; completed_at?: string; status: string }) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedEvalId(e.id)}
                  className="w-full p-4 rounded-xl border border-border bg-card hover:border-muted-foreground/30 text-left transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-foreground">
                        {(e as { competency_cycles?: { name: string } }).competency_cycles?.name ?? 'Ciclo'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {e.completed_at
                          ? new Date(e.completed_at).toLocaleDateString('pt-BR')
                          : 'Rascunho'}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        e.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {e.status === 'completed' ? 'Concluída' : 'Rascunho'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedEval && (
            <div className="card-elevated p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Detalhes da Avaliação
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedEvalId(null)}>
                  Fechar
                </Button>
              </div>
              {(selectedEval.scores ?? []).map((s: { competency_item_id: string; score: number | null; feedback: string | null }) => {
                const item = items?.find((i) => i.id === s.competency_item_id);
                if (!item) return null;
                return (
                  <div key={item.id} className="p-4 rounded-xl bg-muted/30 border border-border">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                        )}
                        {s.feedback && (
                          <p className="text-sm text-muted-foreground mt-2 italic">{s.feedback}</p>
                        )}
                      </div>
                      <StarRating score={s.score} size="sm" />
                    </div>
                  </div>
                );
              })}
              {selectedEval.feedback_global && (
                <div className="pt-4 border-t border-border">
                  <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Feedback Geral
                  </h3>
                  <p className="text-muted-foreground">{selectedEval.feedback_global}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Avaliações de Competências
            </h1>
            <p className="text-muted-foreground mt-1">
              Avalie as competências dos colaboradores por ciclo semestral
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Colaborador</Label>
            <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {(employees ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ciclo</Label>
            <Select value={selectedCycleId || activeCycleId} onValueChange={setSelectedCycleId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ciclo" />
              </SelectTrigger>
              <SelectContent>
                {(cycles ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedProfileId && activeCycleId && (
          <div className="card-elevated p-6 space-y-6">
            <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Competências
            </h2>
            {(items ?? []).map((item) => (
              <div key={item.id} className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-foreground">{item.name}</p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <StarRating
                    score={scores[item.id] ?? null}
                    interactive
                    onChange={(score) => handleScoreChange(item.id, score)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Feedback (opcional)</Label>
                  <Textarea
                    value={feedbackPerCompetency[item.id] ?? ''}
                    onChange={(e) => handleFeedbackChange(item.id, e.target.value)}
                    placeholder="Comentário sobre esta competência..."
                    className="mt-1 min-h-[60px]"
                  />
                </div>
              </div>
            ))}
            <div>
              <Label className="text-sm font-medium">Feedback Geral (opcional)</Label>
              <Textarea
                value={feedbackGlobal}
                onChange={(e) => setFeedbackGlobal(e.target.value)}
                placeholder="Escreva um feedback construtivo para o colaborador..."
                className="mt-2 min-h-[120px]"
              />
            </div>
            <Button
              className="gradient-hero w-full"
              onClick={handleSubmit}
              disabled={
                saveMutation.isPending ||
                (items ?? []).every((i) => !(scores[i.id] && scores[i.id] > 0))
              }
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Salvar Avaliação
            </Button>
          </div>
        )}

        {!selectedProfileId && (
          <div className="card-elevated p-12 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Selecione um colaborador e ciclo para realizar a avaliação</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
