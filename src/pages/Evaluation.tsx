import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Star,
  Calendar,
  TrendingUp,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  User,
  Send,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNotifications } from '@/contexts/NotificationContext';

type EvaluationType =
  | 'self'
  | 'manager_to_employee'
  | 'employee_to_manager'
  | 'hr_to_user'
  | 'direct_feedback';

interface Competency {
  id: string;
  name: string;
  description: string;
  order: number;
}

interface EvaluationPeriod {
  id: string;
  name: string;
  year: number;
  semester: number;
}

interface ProfileOption {
  id: string;
  name: string;
  role: string;
  manager_id?: string | null;
}

interface EvaluationRecord {
  id: string;
  evaluator_id: string;
  evaluated_id: string;
  type: EvaluationType;
  status: string;
  overall_score: number | null;
  feedback_text: string | null;
  submitted_at: string | null;
  period_name?: string;
  evaluator_name?: string;
  evaluated_name?: string;
}

const EVALUATION_TYPE_LABELS: Record<EvaluationType, string> = {
  self: 'Autoavaliação',
  manager_to_employee: 'Gestor → Colaborador',
  employee_to_manager: 'Colaborador → Gestor',
  hr_to_user: 'RH → Usuário',
  direct_feedback: 'Feedback direto',
};

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
          className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
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

function CompetencyRating({
  competency,
  score,
  comment,
  interactive,
  onScoreChange,
  onCommentChange,
}: {
  competency: Competency;
  score: number | null;
  comment: string;
  interactive: boolean;
  onScoreChange: (s: number) => void;
  onCommentChange: (c: string) => void;
}) {
  return (
    <div className="p-4 rounded-xl bg-muted/30 border border-border">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">{competency.name}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{competency.description}</p>
        </div>
        <StarRating
          score={score}
          interactive={interactive}
          onChange={onScoreChange}
        />
      </div>
      {interactive && (
        <div className="mt-3">
          <Textarea
            placeholder="Comentário opcional..."
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            className="min-h-[60px] text-sm"
          />
        </div>
      )}
      {!interactive && comment && (
        <p className="mt-3 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">{comment}</p>
      )}
    </div>
  );
}

export default function Evaluation() {
  const { user, isHR, isManager, canManageUsers } = useAuth();
  const { fetchNotifications } = useNotifications();
  const [activeTab, setActiveTab] = useState('recebidas');
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [peopleOptions, setPeopleOptions] = useState<ProfileOption[]>([]);
  const [receivedEvaluations, setReceivedEvaluations] = useState<EvaluationRecord[]>([]);
  const [sentEvaluations, setSentEvaluations] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formType, setFormType] = useState<EvaluationType>('self');
  const [formEvaluatedId, setFormEvaluatedId] = useState<string>('');
  const [formPeriodId, setFormPeriodId] = useState<string>('none');
  const [formScores, setFormScores] = useState<Record<string, number>>({});
  const [formComments, setFormComments] = useState<Record<string, string>>({});
  const [formFeedbackText, setFormFeedbackText] = useState('');

  const fetchCompetencies = useCallback(async () => {
    const { data } = await supabase
      .from('evaluation_competencies')
      .select('id, name, description, order')
      .order('order');
    setCompetencies((data ?? []) as Competency[]);
  }, []);

  const fetchPeriods = useCallback(async () => {
    if (!user?.tenantId) return;
    const { data } = await supabase
      .from('evaluation_periods')
      .select('id, name, year, semester')
      .eq('tenant_id', user.tenantId)
      .order('year', { ascending: false })
      .order('semester', { ascending: false });
    setPeriods((data ?? []) as EvaluationPeriod[]);
  }, [user?.tenantId]);

  const fetchPeopleOptions = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, name, role, manager_id')
      .order('name');
    const list = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      manager_id: p.manager_id ?? null,
    }));
    setPeopleOptions(list);
  }, [user?.id]);

  const fetchReceivedEvaluations = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('evaluations')
      .select('id, evaluator_id, evaluated_id, type, status, overall_score, feedback_text, submitted_at, period_id')
      .eq('evaluated_id', user.id)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false })
      .limit(50);
    const evals = (data ?? []) as EvaluationRecord[];
    for (const e of evals) {
      const { data: p } = await supabase.from('profiles').select('name').eq('id', e.evaluator_id).maybeSingle();
      (e as EvaluationRecord & { evaluator_name?: string }).evaluator_name = p?.name ?? '—';
    }
    setReceivedEvaluations(evals);
  }, [user?.id]);

  const fetchSentEvaluations = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('evaluations')
      .select('id, evaluator_id, evaluated_id, type, status, overall_score, feedback_text, submitted_at, period_id')
      .eq('evaluator_id', user.id)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false })
      .limit(50);
    const evals = (data ?? []) as EvaluationRecord[];
    for (const e of evals) {
      const { data: p } = await supabase.from('profiles').select('name').eq('id', e.evaluated_id).maybeSingle();
      (e as EvaluationRecord & { evaluated_name?: string }).evaluated_name = p?.name ?? '—';
    }
    setSentEvaluations(evals);
  }, [user?.id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([
        fetchCompetencies(),
        fetchPeriods(),
        fetchPeopleOptions(),
        fetchReceivedEvaluations(),
        fetchSentEvaluations(),
      ]);
      setLoading(false);
    };
    load();
  }, [fetchCompetencies, fetchPeriods, fetchPeopleOptions, fetchReceivedEvaluations, fetchSentEvaluations]);

  const myProfile = peopleOptions.find((p) => p.id === user?.id);
  const myManagerId = myProfile?.manager_id ?? null;

  const eligibleOptions = (() => {
    if (formType === 'self') return [{ id: user!.id, name: user!.name, role: user!.role }];
    if (formType === 'employee_to_manager' && myManagerId) {
      const m = peopleOptions.find((p) => p.id === myManagerId);
      return m ? [m] : [];
    }
    if (formType === 'manager_to_employee') {
      return peopleOptions.filter((p) => p.role === 'employee');
    }
    if (formType === 'hr_to_user' || formType === 'direct_feedback') {
      return peopleOptions.filter((p) => p.id !== user?.id);
    }
    return [];
  })();

  const canShowType = (t: EvaluationType): boolean => {
    if (!user) return false;
    if (t === 'self') return true;
    if (t === 'employee_to_manager') return user.role === 'employee' && !!myManagerId;
    if (t === 'manager_to_employee') return isManager();
    if (t === 'hr_to_user') return isHR();
    if (t === 'direct_feedback') return true;
    return false;
  };

  const handleSubmit = async () => {
    if (!user?.tenantId || !user?.id) return;

    const evaluatedId = formType === 'self' ? user.id : formEvaluatedId;
    if (!evaluatedId) {
      toast.error('Selecione o avaliado');
      return;
    }

    const isDirectFeedback = formType === 'direct_feedback';
    if (isDirectFeedback) {
      if (!formFeedbackText.trim()) {
        toast.error('Escreva o feedback');
        return;
      }
    } else {
      const allScored = competencies.every((c) => formScores[c.id] >= 1 && formScores[c.id] <= 5);
      if (!allScored) {
        toast.error('Preencha a nota (1 a 5) em todas as competências');
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        toast.error('Sessão expirada. Faça login novamente.');
        setSubmitting(false);
        return;
      }

      const periodId = formPeriodId === 'none' ? null : formPeriodId;
      const scores = competencies.map((c) => formScores[c.id] ?? 0);
      const overallScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      const { data: evalData, error: evalError } = await supabase
        .from('evaluations')
        .insert({
          tenant_id: user.tenantId,
          period_id: periodId,
          evaluator_id: user.id,
          evaluated_id: evaluatedId,
          type: formType,
          status: 'submitted',
          overall_score: isDirectFeedback ? null : overallScore,
          feedback_text: isDirectFeedback ? formFeedbackText : null,
          submitted_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (evalError) throw evalError;
      const evaluationId = evalData?.id;
      if (!evaluationId) throw new Error('Erro ao criar avaliação');

      if (!isDirectFeedback) {
        for (const c of competencies) {
          const score = formScores[c.id];
          const comment = formComments[c.id] ?? null;
          if (score >= 1 && score <= 5) {
            await supabase.from('evaluation_scores').insert({
              evaluation_id: evaluationId,
              competency_id: c.id,
              score,
              comment: comment || null,
            });
          }
        }
      }

      const { data: evaluatedProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', evaluatedId)
        .maybeSingle();

      const title = isDirectFeedback ? 'Você recebeu um feedback' : 'Você recebeu uma avaliação';
      const body = isDirectFeedback
        ? `${user.name} enviou um feedback para você.`
        : `${user.name} realizou uma avaliação sobre você.`;

      await supabase.from('notifications').insert({
        tenant_id: user.tenantId,
        user_id: evaluatedId,
        type: isDirectFeedback ? 'feedback_received' : 'evaluation_received',
        title,
        body,
        related_id: evaluationId,
      });

      const { error: emailErr } = await supabase.functions.invoke('send-notification-email', {
        body: {
          evaluatedUserId: evaluatedId,
          evaluatorName: user.name,
          type: isDirectFeedback ? 'feedback' : 'evaluation',
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (emailErr) console.warn('Email notification failed:', emailErr);

      toast.success(isDirectFeedback ? 'Feedback enviado!' : 'Avaliação enviada!');
      setFormEvaluatedId('');
      setFormPeriodId('none');
      setFormScores({});
      setFormComments({});
      setFormFeedbackText('');
      fetchNotifications();
      fetchReceivedEvaluations();
      fetchSentEvaluations();
      setActiveTab('enviadas');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar. Tente novamente.');
    }
    setSubmitting(false);
  };


  if (!user) return null;

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Avaliações e Feedbacks
          </h1>
          <p className="text-muted-foreground mt-1">
            Ciclo de feedback 360° – realize avaliações, autoavaliação e feedback direto
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="recebidas">Recebidas</TabsTrigger>
            <TabsTrigger value="realizar">Realizar</TabsTrigger>
            <TabsTrigger value="enviadas">Enviadas</TabsTrigger>
          </TabsList>

          <TabsContent value="recebidas" className="mt-6">
            <div className="space-y-3">
              <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Avaliações e feedbacks que você recebeu
              </h2>
              {loading ? (
                <div className="card-elevated p-8 text-center text-muted-foreground">Carregando...</div>
              ) : receivedEvaluations.length === 0 ? (
                <div className="card-elevated p-12 text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma avaliação ou feedback recebido ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {receivedEvaluations.map((e) => (
                    <div
                      key={e.id}
                      className="card-elevated p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{e.evaluator_name ?? '—'}</p>
                        <p className="text-sm text-muted-foreground">
                          {EVALUATION_TYPE_LABELS[e.type as EvaluationType]}
                          {e.submitted_at && (
                            <> · {new Date(e.submitted_at).toLocaleDateString('pt-BR')}</>
                          )}
                        </p>
                      </div>
                      {e.overall_score != null && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="font-semibold">{e.overall_score.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="realizar" className="mt-6">
            <div className="card-elevated p-6 space-y-6">
              <div className="space-y-2">
                <Label>Tipo de avaliação</Label>
                <Select value={formType} onValueChange={(v) => { setFormType(v as EvaluationType); setFormEvaluatedId(''); }}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['self', 'employee_to_manager', 'manager_to_employee', 'hr_to_user', 'direct_feedback'] as EvaluationType[])
                      .filter(canShowType)
                      .map((t) => (
                        <SelectItem key={t} value={t}>
                          {EVALUATION_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {formType !== 'self' && (
                <div className="space-y-2">
                  <Label>Avaliado</Label>
                  <Select
                    value={formEvaluatedId}
                    onValueChange={setFormEvaluatedId}
                    disabled={eligibleOptions.length === 0}
                  >
                    <SelectTrigger className="max-w-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formType !== 'direct_feedback' && (
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select value={formPeriodId} onValueChange={setFormPeriodId}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem período</SelectItem>
                      {periods.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formType === 'direct_feedback' ? (
                <div className="space-y-2">
                  <Label>Feedback</Label>
                  <Textarea
                    placeholder="Escreva seu feedback..."
                    value={formFeedbackText}
                    onChange={(e) => setFormFeedbackText(e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Competências
                  </h3>
                  {competencies.map((c) => (
                    <CompetencyRating
                      key={c.id}
                      competency={c}
                      score={formScores[c.id] ?? null}
                      comment={formComments[c.id] ?? ''}
                      interactive
                      onScoreChange={(s) => setFormScores((prev) => ({ ...prev, [c.id]: s }))}
                      onCommentChange={(s) => setFormComments((prev) => ({ ...prev, [c.id]: s }))}
                    />
                  ))}
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <Button
                  className="gradient-hero"
                  onClick={handleSubmit}
                  disabled={submitting || (formType !== 'self' && !formEvaluatedId)}
                >
                  {submitting ? (
                    'Enviando...'
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="enviadas" className="mt-6">
            <div className="space-y-3">
              <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Avaliações e feedbacks que você enviou
              </h2>
              {loading ? (
                <div className="card-elevated p-8 text-center text-muted-foreground">Carregando...</div>
              ) : sentEvaluations.length === 0 ? (
                <div className="card-elevated p-12 text-center text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma avaliação ou feedback enviado ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sentEvaluations.map((e) => (
                    <div
                      key={e.id}
                      className="card-elevated p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{(e as EvaluationRecord & { evaluated_name?: string }).evaluated_name ?? '—'}</p>
                        <p className="text-sm text-muted-foreground">
                          {EVALUATION_TYPE_LABELS[e.type as EvaluationType]}
                          {e.submitted_at && (
                            <> · {new Date(e.submitted_at).toLocaleDateString('pt-BR')}</>
                          )}
                        </p>
                      </div>
                      {e.overall_score != null && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="font-semibold">{e.overall_score.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
