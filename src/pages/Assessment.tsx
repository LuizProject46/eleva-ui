import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Zap,
  Users,
  BarChart3,
  Shield,
  SlidersHorizontal,
  ClipboardList,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBehavioralReportDownload } from '@/hooks/useBehavioralReportDownload';
import { usePeriodicityWindow } from '@/hooks/usePeriodicityWindow';
import { PeriodUnavailableMessage } from '@/components/PeriodUnavailableMessage';

type AssessmentStatus = 'not_started' | 'in_progress' | 'completed';

interface BehavioralAssessmentRow {
  id: string;
  user_id: string;
  tenant_id: string;
  status: AssessmentStatus;
  answers: Record<string, string> | null;
  result: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AssessmentAdminRow {
  user_id: string;
  name: string | null;
  department: string | null;
  manager_id: string | null;
  status: string;
  completed_at: string | null;
}

interface ManagerOption {
  id: string;
  name: string;
}

interface AdminRowWithManager extends AssessmentAdminRow {
  manager_name: string | null;
}

const DEFAULT_DEPARTMENTS = [
  'Administrativo',
  'Comercial',
  'Financeiro',
  'Marketing',
  'Operações',
  'Recursos Humanos',
  'Tecnologia',
  'Vendas',
] as const;

const ASSESSMENT_STATUS_LABELS: Record<string, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Em progresso',
  completed: 'Concluído',
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

interface Question {
  id: string;
  text: string;
  options: { value: 'D' | 'I' | 'S' | 'C'; text: string }[];
}

const discQuestions: Question[] = [
  {
    id: '1',
    text: 'Em situações de trabalho, você prefere:',
    options: [
      { value: 'D', text: 'Tomar decisões rápidas e assumir o controle' },
      { value: 'I', text: 'Interagir com pessoas e persuadir outros' },
      { value: 'S', text: 'Manter a estabilidade e apoiar o time' },
      { value: 'C', text: 'Analisar dados e seguir procedimentos' },
    ],
  },
  {
    id: '2',
    text: 'Quando surge um problema inesperado, você tende a:',
    options: [
      { value: 'D', text: 'Agir imediatamente para resolver' },
      { value: 'I', text: 'Conversar com pessoas para buscar ideias' },
      { value: 'S', text: 'Manter a calma e apoiar os envolvidos' },
      { value: 'C', text: 'Avaliar dados antes de decidir' },
    ],
  },
  {
    id: '3',
    text: 'Você se sente mais confortável quando:',
    options: [
      { value: 'D', text: 'Pode liderar e tomar decisões' },
      { value: 'I', text: 'Pode se comunicar livremente' },
      { value: 'S', text: 'Existe harmonia no ambiente' },
      { value: 'C', text: 'As regras estão bem definidas' },
    ],
  },
  {
    id: '4',
    text: 'Em reuniões, você geralmente:',
    options: [
      { value: 'D', text: 'Direciona a conversa para resultados' },
      { value: 'I', text: 'Traz entusiasmo e engaja o grupo' },
      { value: 'S', text: 'Escuta e busca consenso' },
      { value: 'C', text: 'Analisa detalhes e faz perguntas técnicas' },
    ],
  },
  {
    id: '5',
    text: 'Seu ritmo de trabalho é melhor quando:',
    options: [
      { value: 'D', text: 'Há desafios constantes' },
      { value: 'I', text: 'Há interação com outras pessoas' },
      { value: 'S', text: 'O ambiente é previsível' },
      { value: 'C', text: 'Os processos são bem definidos' },
    ],
  },
  {
    id: '6',
    text: 'Você se destaca mais quando pode:',
    options: [
      { value: 'D', text: 'Assumir responsabilidades e decidir' },
      { value: 'I', text: 'Influenciar e motivar pessoas' },
      { value: 'S', text: 'Oferecer suporte e estabilidade' },
      { value: 'C', text: 'Garantir qualidade e precisão' },
    ],
  },
  {
    id: '7',
    text: 'Diante de mudanças, você tende a:',
    options: [
      { value: 'D', text: 'Aceitar rapidamente e seguir em frente' },
      { value: 'I', text: 'Ver oportunidades e envolver pessoas' },
      { value: 'S', text: 'Preferir adaptação gradual' },
      { value: 'C', text: 'Avaliar riscos antes de aceitar' },
    ],
  },
  {
    id: '8',
    text: 'O que mais te motiva no trabalho?',
    options: [
      { value: 'D', text: 'Resultados e desafios' },
      { value: 'I', text: 'Reconhecimento e interação' },
      { value: 'S', text: 'Segurança e colaboração' },
      { value: 'C', text: 'Organização e qualidade' },
    ],
  },
  {
    id: '9',
    text: 'Você costuma ser visto como alguém que:',
    options: [
      { value: 'D', text: 'É direto e objetivo' },
      { value: 'I', text: 'É comunicativo e otimista' },
      { value: 'S', text: 'É paciente e confiável' },
      { value: 'C', text: 'É analítico e criterioso' },
    ],
  },
  {
    id: '10',
    text: 'Quando trabalha em equipe, você prefere:',
    options: [
      { value: 'D', text: 'Definir metas e cobrar resultados' },
      { value: 'I', text: 'Criar um clima positivo' },
      { value: 'S', text: 'Garantir cooperação entre todos' },
      { value: 'C', text: 'Definir processos e padrões' },
    ],
  },
  {
    id: '11',
    text: 'Seu maior diferencial profissional é:',
    options: [
      { value: 'D', text: 'Determinação' },
      { value: 'I', text: 'Persuasão' },
      { value: 'S', text: 'Constância' },
      { value: 'C', text: 'Precisão' },
    ],
  },
  {
    id: '12',
    text: 'Você se sente mais produtivo quando:',
    options: [
      { value: 'D', text: 'Tem autonomia para decidir' },
      { value: 'I', text: 'Trabalha com outras pessoas' },
      { value: 'S', text: 'Tem estabilidade no ambiente' },
      { value: 'C', text: 'Segue processos claros' },
    ],
  },
  {
    id: '13',
    text: 'Em situações de pressão, você:',
    options: [
      { value: 'D', text: 'Age rapidamente para resolver' },
      { value: 'I', text: 'Motiva o grupo' },
      { value: 'S', text: 'Mantém a calma' },
      { value: 'C', text: 'Analisa cuidadosamente' },
    ],
  },
  {
    id: '14',
    text: 'Você prefere tarefas que:',
    options: [
      { value: 'D', text: 'Exijam decisão e ação' },
      { value: 'I', text: 'Envolvam comunicação' },
      { value: 'S', text: 'Sejam previsíveis' },
      { value: 'C', text: 'Exijam atenção aos detalhes' },
    ],
  },
  {
    id: '15',
    text: 'No trabalho, você valoriza mais:',
    options: [
      { value: 'D', text: 'Resultados' },
      { value: 'I', text: 'Relacionamentos' },
      { value: 'S', text: 'Estabilidade' },
      { value: 'C', text: 'Qualidade' },
    ],
  },
  {
    id: '16',
    text: 'Quando recebe uma tarefa nova, você:',
    options: [
      { value: 'D', text: 'Começa imediatamente' },
      { value: 'I', text: 'Discute com outras pessoas' },
      { value: 'S', text: 'Segue o passo a passo' },
      { value: 'C', text: 'Planeja antes de executar' },
    ],
  },
  {
    id: '17',
    text: 'Você prefere ser reconhecido por:',
    options: [
      { value: 'D', text: 'Resultados alcançados' },
      { value: 'I', text: 'Boa comunicação' },
      { value: 'S', text: 'Lealdade e apoio' },
      { value: 'C', text: 'Excelência técnica' },
    ],
  },
  {
    id: '18',
    text: 'Você se sente mais confiante quando:',
    options: [
      { value: 'D', text: 'Tem controle da situação' },
      { value: 'I', text: 'Pode influenciar pessoas' },
      { value: 'S', text: 'O ambiente é estável' },
      { value: 'C', text: 'Tem informações completas' },
    ],
  },
  {
    id: '19',
    text: 'Seu estilo de comunicação é mais:',
    options: [
      { value: 'D', text: 'Direto' },
      { value: 'I', text: 'Expressivo' },
      { value: 'S', text: 'Calmo' },
      { value: 'C', text: 'Detalhado' },
    ],
  },
  {
    id: '20',
    text: 'Em projetos, você costuma:',
    options: [
      { value: 'D', text: 'Assumir a liderança' },
      { value: 'I', text: 'Engajar o time' },
      { value: 'S', text: 'Dar suporte constante' },
      { value: 'C', text: 'Controlar a qualidade' },
    ],
  },
  {
    id: '21',
    text: 'Você prefere ambientes que:',
    options: [
      { value: 'D', text: 'Sejam desafiadores' },
      { value: 'I', text: 'Sejam colaborativos' },
      { value: 'S', text: 'Sejam estáveis' },
      { value: 'C', text: 'Sejam organizados' },
    ],
  },
  {
    id: '22',
    text: 'Seu foco principal costuma ser:',
    options: [
      { value: 'D', text: 'Resultado final' },
      { value: 'I', text: 'Relacionamento com pessoas' },
      { value: 'S', text: 'Bem-estar do grupo' },
      { value: 'C', text: 'Correção do processo' },
    ],
  },
  {
    id: '23',
    text: 'Você aprende melhor quando:',
    options: [
      { value: 'D', text: 'Pode aplicar rapidamente' },
      { value: 'I', text: 'Pode discutir ideias' },
      { value: 'S', text: 'Tem tempo para absorver' },
      { value: 'C', text: 'Tem material estruturado' },
    ],
  },
  {
    id: '24',
    text: 'No trabalho, você tende a ser:',
    options: [
      { value: 'D', text: 'Assertivo' },
      { value: 'I', text: 'Entusiasmado' },
      { value: 'S', text: 'Constante' },
      { value: 'C', text: 'Cuidadoso' },
    ],
  },
];


const discProfiles = {
  D: {
    name: 'Dominância',
    color: 'from-red-500 to-orange-500',
    icon: Zap,
    traits: ['Direto', 'Decisivo', 'Orientado a resultados', 'Competitivo'],
    description: 'Você é movido por desafios e resultados. Tem facilidade para tomar decisões rápidas e liderar equipes em direção a objetivos claros.',
  },
  I: {
    name: 'Influência',
    color: 'from-amber-400 to-yellow-500',
    icon: Users,
    traits: ['Entusiasta', 'Comunicativo', 'Persuasivo', 'Otimista'],
    description: 'Você tem excelentes habilidades interpessoais e consegue motivar e influenciar pessoas. Sua energia positiva contagia o ambiente.',
  },
  S: {
    name: 'Estabilidade',
    color: 'from-emerald-500 to-teal-500',
    icon: Shield,
    traits: ['Paciente', 'Confiável', 'Cooperativo', 'Bom ouvinte'],
    description: 'Você valoriza harmonia e consistência. É um excelente colaborador que contribui para um ambiente de trabalho estável e produtivo.',
  },
  C: {
    name: 'Conformidade',
    color: 'from-blue-500 to-indigo-500',
    icon: BarChart3,
    traits: ['Analítico', 'Preciso', 'Sistemático', 'Cauteloso'],
    description: 'Você tem uma mente analítica e valoriza qualidade e precisão. Excelente em tarefas que exigem atenção aos detalhes e planejamento.',
  },
};

function canTakeAssessment(role: string): boolean {
  return role === 'employee' || role === 'hr' || role === 'manager';
}

export default function Assessment() {
  const { user, isHR, isManager } = useAuth();
  const canSeeAdminList = isHR() || isManager();
  const {
    downloadReport,
    isDownloading,
    downloadingUserId,
  } = useBehavioralReportDownload();

  const [myAssessment, setMyAssessment] = useState<BehavioralAssessmentRow | null>(null);
  const [isLoadingMyAssessment, setIsLoadingMyAssessment] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, 'D' | 'I' | 'S' | 'C'>>({});
  const [showResult, setShowResult] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [adminList, setAdminList] = useState<AssessmentAdminRow[]>([]);
  const [isLoadingAdminList, setIsLoadingAdminList] = useState(false);
  const [adminPage, setAdminPage] = useState(1);
  const [adminPageSize, setAdminPageSize] = useState(10);
  const [adminTotalCount, setAdminTotalCount] = useState(0);
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterManager, setFilterManager] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterName, setFilterName] = useState('');
  const [appliedFilterDepartment, setAppliedFilterDepartment] = useState('all');
  const [appliedFilterManager, setAppliedFilterManager] = useState('all');
  const [appliedFilterStatus, setAppliedFilterStatus] = useState('all');
  const [appliedFilterName, setAppliedFilterName] = useState('');
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [adminFiltersOpen, setAdminFiltersOpen] = useState(false);

  const { isWithinPeriod: isWithinAssessmentPeriod, periodStatus, currentPeriod, nextPeriodStart } = usePeriodicityWindow('assessment');
  const canTake = user?.role && canTakeAssessment(user.role);

  const alreadyCompletedInCurrentPeriod = useMemo(() => {
    if (!currentPeriod || !myAssessment?.completed_at || myAssessment?.status !== 'completed') return false;
    const completedDate = myAssessment.completed_at.slice(0, 10);
    return completedDate >= currentPeriod.periodStart && completedDate <= currentPeriod.periodEnd;
  }, [currentPeriod, myAssessment?.completed_at, myAssessment?.status]);

  const fetchMyAssessment = useCallback(async () => {
    if (!canTake || !user?.id) return;
    setIsLoadingMyAssessment(true);
    const { data, error } = await supabase
      .from('behavioral_assessments')
      .select('id, user_id, tenant_id, status, answers, result, completed_at, created_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      toast.error('Erro ao carregar o teste comportamental');
      return
    }

    setMyAssessment(data as BehavioralAssessmentRow | null);
    setAnswers(data?.answers as Record<string, 'D' | 'I' | 'S' | 'C'> || {});


    if (data?.status === 'completed' && data?.completed_at) {
      setShowResult(true);
    } else {
      Object.keys(data?.answers || {}).length > 0 ? setCurrentQuestion(Object.keys(data?.answers || {}).length - 1) : setCurrentQuestion(-1);
    }
    setIsLoadingMyAssessment(false);
  }, [canTake, user?.id]);

  useEffect(() => {
    fetchMyAssessment();
  }, [fetchMyAssessment]);

  useEffect(() => {
    if (!myAssessment || myAssessment.status !== 'in_progress' || !myAssessment.answers || typeof myAssessment.answers !== 'object') return;
    const restored = myAssessment.answers as Record<string, 'D' | 'I' | 'S' | 'C'>;
    const firstUnanswered = discQuestions.findIndex(q => !restored[q.id]);

    setAnswers(restored);

    if (firstUnanswered === -1) {
      setShowResult(true);
    } else {
      setCurrentQuestion(firstUnanswered);
    }
  }, [myAssessment?.id, myAssessment?.status, myAssessment?.answers]);

  const fetchManagers = useCallback(async () => {
    if (!canSeeAdminList || !user?.tenantId) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'manager')
      .eq('tenant_id', user.tenantId)
      .eq('is_active', true)
      .order('name');
    setManagers((data ?? []).map(r => ({ id: r.id, name: r.name ?? '' })));
  }, [canSeeAdminList, user?.tenantId]);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  const fetchAdminList = useCallback(async () => {
    if (!canSeeAdminList || !user?.tenantId) return;
    setIsLoadingAdminList(true);
    let query = supabase
      .from('assessment_admin_list')
      .select('*', { count: 'exact' })
      .neq('user_id', user.id)
      .order('name');
    if (appliedFilterDepartment !== 'all') query = query.eq('department', appliedFilterDepartment);
    if (appliedFilterManager !== 'all') query = query.eq('manager_id', appliedFilterManager);
    if (appliedFilterStatus !== 'all') query = query.eq('status', appliedFilterStatus);
    if (appliedFilterName.trim()) query = query.ilike('name', `%${appliedFilterName.trim()}%`);
    query = query.range((adminPage - 1) * adminPageSize, adminPage * adminPageSize - 1);
    const { data, error, count } = await query;
    if (!error) {
      setAdminTotalCount(count ?? 0);
      setAdminList((data ?? []) as AssessmentAdminRow[]);
    }
    setIsLoadingAdminList(false);
  }, [canSeeAdminList, user?.tenantId, adminPage, adminPageSize, appliedFilterDepartment, appliedFilterManager, appliedFilterStatus, appliedFilterName]);

  useEffect(() => {
    if (!canSeeAdminList) return;
    fetchAdminList();
  }, [canSeeAdminList, fetchAdminList]);

  const upsertAssessment = useCallback(
    async (updates: {
      status: AssessmentStatus;
      answers?: Record<string, string>;
      result?: string | null;
      completed_at?: string | null;
    }) => {
      if (!user?.id || !user?.tenantId) return;
      setIsSaving(true);
      const payload = {
        user_id: user.id,
        tenant_id: user.tenantId,
        status: updates.status,
        answers: updates.answers ?? null,
        result: updates.result ?? null,
        completed_at: updates.completed_at ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('behavioral_assessments').upsert(payload, {
        onConflict: 'user_id',
      });
      setIsSaving(false);
      if (error) {
        const msg = error.message ?? '';
        if (msg.includes('já realizado neste período') || msg.includes('Próximo disponível')) {
          toast.error(msg);
        } else {
          toast.error(msg || 'Erro ao salvar o teste');
        }
        return;
      }
      setMyAssessment(prev => (prev ? { ...prev, ...updates } : null));
    },
    [user?.id, user?.tenantId]
  );

  const handleAnswer = (questionId: string, value: 'D' | 'I' | 'S' | 'C') => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = async () => {
    if (currentQuestion < discQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      await upsertAssessment({
        status: 'in_progress',
        answers: answers as Record<string, string>,
      });
    } else {
      try {
        setIsLoadingMyAssessment(true);

        const finalAnswers = { ...answers, [discQuestions[currentQuestion].id]: answers[discQuestions[currentQuestion].id] } as Record<string, 'D' | 'I' | 'S' | 'C'>;
        const counts = { D: 0, I: 0, S: 0, C: 0 };

        Object.values(finalAnswers).forEach(v => { counts[v]++; });

        const resultKey = (Object.keys(counts) as Array<'D' | 'I' | 'S' | 'C'>).reduce((a, b) => (counts[a] > counts[b] ? a : b));

        setShowResult(true);

        await upsertAssessment({
          status: 'completed',
          answers: finalAnswers as Record<string, string>,
          result: resultKey,
          completed_at: new Date().toISOString(),
        });


        await fetchMyAssessment();
      } catch (error) {
        console.error('Error fetching my assessment', error);
      } finally {
        setIsLoadingMyAssessment(false);
      }
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const calculateResult = (): 'D' | 'I' | 'S' | 'C' => {
    const counts = { D: 0, I: 0, S: 0, C: 0 };

    Object.values(answers).forEach(value => {
      counts[value]++;
    });
    return (Object.keys(counts) as Array<'D' | 'I' | 'S' | 'C'>).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    );
  };

  const progress = ((currentQuestion + 1) / discQuestions.length) * 100;
  const currentQ = discQuestions[currentQuestion];
  const result = showResult ? discProfiles[calculateResult()] : null;
  const ResultIcon = result?.icon || Brain;

  const isIntroShown = !showResult && currentQuestion === -1 && Object.keys(answers).length === 0;
  const canContinue = myAssessment?.status === 'in_progress' && myAssessment.answers && typeof myAssessment.answers === 'object' && Object.keys(myAssessment.answers).length > 0;

  const adminTotalPages = Math.ceil(adminTotalCount / adminPageSize) || 1;
  const adminStartRow = adminTotalCount === 0 ? 0 : (adminPage - 1) * adminPageSize + 1;
  const adminEndRow = Math.min(adminPage * adminPageSize, adminTotalCount);
  const adminHasActiveFilters = appliedFilterDepartment !== 'all' || appliedFilterManager !== 'all' || appliedFilterStatus !== 'all' || appliedFilterName.trim() !== '';
  const adminActiveFilterCount = [
    appliedFilterDepartment !== 'all',
    appliedFilterManager !== 'all',
    appliedFilterStatus !== 'all',
    appliedFilterName.trim() !== '',
  ].filter(Boolean).length;
  const adminListWithManagerName: AdminRowWithManager[] = useMemo(() => {
    return adminList.map(row => ({
      ...row,
      manager_name: row.manager_id ? managers.find(m => m.id === row.manager_id)?.name ?? null : null,
    }));
  }, [adminList, managers]);

  const handleStartOrContinue = async () => {
    if (canContinue && myAssessment?.answers) {
      const restored = myAssessment.answers as Record<string, 'D' | 'I' | 'S' | 'C'>;
      setAnswers(restored);
      const firstUnanswered = discQuestions.findIndex(q => !restored[q.id]);
      if (firstUnanswered === -1) setShowResult(true);
      else setCurrentQuestion(firstUnanswered);
    } else {
      setCurrentQuestion(0);
      await upsertAssessment({
        status: 'in_progress',
        answers: {},
      });
    }
  };

  let mainContent: React.ReactNode;

  if (isLoadingMyAssessment) {
    mainContent = (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  } else if (canTake && isIntroShown) {
    mainContent = (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-6">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Teste Comportamental
          </h1>
          <p className="text-muted-foreground mt-2">
            Descubra seu perfil comportamental e entenda seus pontos fortes
          </p>
          {myAssessment && (
            <p className="text-sm text-muted-foreground mt-2">
              Seu status:{' '}
              {myAssessment.status === 'completed' && myAssessment.completed_at
                ? `Concluído em ${new Date(myAssessment.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                : myAssessment.status === 'in_progress'
                  ? 'Em progresso'
                  : 'Não iniciado'}
            </p>
          )}
        </div>

        <div className="card-elevated p-8 text-center">
          <div className="grid grid-cols-2 gap-4 mb-8">
            {Object.entries(discProfiles).map(([key, profile]) => {
              const Icon = profile.icon;
              return (
                <div key={key} className="p-4 rounded-xl bg-muted/30">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${profile.color} flex items-center justify-center mx-auto mb-2`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold text-foreground">{profile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{key}</p>
                </div>
              );
            })}
          </div>

          <div className="space-y-4 text-left mb-8">
            <h3 className="font-semibold text-foreground">Como funciona:</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">1</div>
                Responda {discQuestions.length} perguntas sobre seu comportamento
              </li>
              <li className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">2</div>
                Escolha a opção que mais se parece com você
              </li>
              <li className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">3</div>
                Receba seu perfil DISC detalhado
              </li>
            </ul>
          </div>

          {alreadyCompletedInCurrentPeriod ? (
            <div className="mt-4">
              <PeriodUnavailableMessage
                entityLabel="Teste DISC"
                periodStatus="within"
                currentPeriod={currentPeriod}
                nextPeriodStart={nextPeriodStart}
                variant="already_completed"
              />
            </div>
          ) : (
            <>
              <Button
                className="w-full gradient-hero py-6 text-lg"
                onClick={handleStartOrContinue}
                disabled={isSaving || !isWithinAssessmentPeriod}
                title={!isWithinAssessmentPeriod ? 'Teste disponível apenas dentro do período configurado em Configurações.' : undefined}
              >
                {canContinue ? 'Continuar' : !isWithinAssessmentPeriod ? 'Teste indisponível no momento' : 'Iniciar Teste'}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>

              {!isWithinAssessmentPeriod && periodStatus && (
                <div className="mt-4">
                  <PeriodUnavailableMessage
                    entityLabel="Teste DISC"
                    periodStatus={periodStatus}
                    currentPeriod={currentPeriod}
                    nextPeriodStart={nextPeriodStart}
                  />
                </div>
              )}
            </>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            Tempo estimado: 5 minutos
          </p>
        </div>
      </div>
    );

  } else if (showResult && result) {

    mainContent = (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <CheckCircle2 className="w-6 h-6 text-primary" />
            <span className="text-primary font-medium">Teste Concluído</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Seu Perfil DISC
          </h1>
        </div>

        <div className="card-elevated p-8">
          <div className="text-center mb-8">
            <div className={`w-24 h-24 rounded-2xl bg-gradient-to-r ${result.color} flex items-center justify-center mx-auto mb-4`}>
              <ResultIcon className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              {result.name}
            </h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              {result.description}
            </p>
          </div>

          <div className="mb-8">
            <h3 className="font-semibold text-foreground mb-4">Características Principais</h3>
            <div className="flex flex-wrap gap-2">
              {result.traits.map((trait) => (
                <span
                  key={trait}
                  className={`px-4 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r ${result.color}`}
                >
                  {trait}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            {Object.entries(discProfiles).map(([key, profile]) => {
              const count = Object.values(answers).filter(v => v === key).length;
              const percentage = (count / discQuestions.length) * 100;
              return (
                <div key={key} className="text-center">
                  <div className={`w-full h-2 rounded-full bg-muted mb-2 overflow-hidden`}>
                    <div
                      className={`h-full bg-gradient-to-r ${profile.color} transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-sm font-medium text-foreground">{key}</p>
                  <p className="text-xs text-muted-foreground">{Math.round(percentage)}%</p>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 flex-col">
            <div>
              {alreadyCompletedInCurrentPeriod && nextPeriodStart && (
                <div className="mt-4">
                  <PeriodUnavailableMessage
                    entityLabel="Teste DISC"
                    periodStatus="within"
                    currentPeriod={currentPeriod}
                    nextPeriodStart={nextPeriodStart}
                    variant="already_completed"
                  />
                </div>
              )}

              {!isWithinAssessmentPeriod && periodStatus && (
                <div className="mt-4">
                  <PeriodUnavailableMessage
                    entityLabel="Teste DISC"
                    periodStatus={periodStatus}
                    currentPeriod={currentPeriod}
                    nextPeriodStart={nextPeriodStart}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  setShowResult(false);
                  setCurrentQuestion(0);
                  setAnswers({});
                  await upsertAssessment({
                    status: 'in_progress',
                    answers: {},
                    result: null,
                    completed_at: null,
                  });
                  fetchMyAssessment();
                }}
                disabled={isSaving || !isWithinAssessmentPeriod || alreadyCompletedInCurrentPeriod}
                title={
                  alreadyCompletedInCurrentPeriod
                    ? 'Você já realizou o teste neste período.'
                    : !isWithinAssessmentPeriod
                      ? 'Refazer teste disponível apenas dentro do período configurado em Configurações.'
                      : undefined
                }
              >
                Refazer Teste
              </Button>
              <Button
                className="flex-1 gradient-hero"
                disabled={isDownloading}
                onClick={() => downloadReport()}
              >
                {isDownloading ? 'Gerando PDF…' : 'Baixar Relatório (PDF)'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    mainContent = (
      <div className="max-w-2xl mx-auto animate-fade-in">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Pergunta {currentQuestion + 1} de {discQuestions.length}
            </span>
            <span className="text-sm font-medium text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question Card */}
        <div className="card-elevated p-8">
          <h2 className="text-xl font-display font-semibold text-foreground mb-6">
            {currentQ.text}
          </h2>

          <div className="space-y-3">
            {currentQ.options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswer(currentQ.id, option.value)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${answers[currentQ.id] === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
                  }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${answers[currentQ.id] === option.value
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground/30'
                    }`}>
                    {answers[currentQ.id] === option.value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <span className={answers[currentQ.id] === option.value ? 'text-primary font-medium' : 'text-foreground'}>
                    {option.text}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-4 mt-8">
            {currentQuestion > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>
            )}

            <Button
              className="flex-1 gradient-hero"
              onClick={handleNext}
              disabled={!answers[currentQ.id]}
            >
              {currentQuestion === discQuestions.length - 1 ? 'Ver Resultado' : 'Próxima'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const adminContent = (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      <div>
        <h2 className="text-xl font-display font-semibold text-foreground">
          Acompanhamento de avaliações
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Status do teste comportamental por colaborador
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Sheet open={adminFiltersOpen} onOpenChange={setAdminFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {adminHasActiveFilters && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {adminActiveFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
            <SheetHeader className="border-b px-6 py-4">
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-5 p-6">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm text-muted-foreground">Nome</Label>
                  <Input
                    placeholder="Buscar por nome..."
                    value={filterName}
                    onChange={(e) => {
                      setFilterName(e.target.value);

                    }}
                    className="h-9 w-full"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-sm text-muted-foreground">Setor</Label>
                  <Select
                    value={filterDepartment}
                    onValueChange={(v) => {
                      setFilterDepartment(v);

                    }}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {DEFAULT_DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-sm text-muted-foreground">Equipe (gestor)</Label>
                  <Select
                    value={filterManager}
                    onValueChange={(v) => {
                      setFilterManager(v);

                    }}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <Select
                    value={filterStatus}
                    onValueChange={(v) => {
                      setFilterStatus(v);

                    }}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="not_started">{ASSESSMENT_STATUS_LABELS.not_started}</SelectItem>
                      <SelectItem value="in_progress">{ASSESSMENT_STATUS_LABELS.in_progress}</SelectItem>
                      <SelectItem value="completed">{ASSESSMENT_STATUS_LABELS.completed}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-2 space-y-2">
                  <Button
                    onClick={() => {
                      setAppliedFilterDepartment(filterDepartment);
                      setAppliedFilterManager(filterManager);
                      setAppliedFilterStatus(filterStatus);
                      setAppliedFilterName(filterName);
                      setAdminPage(1);
                      setAdminFiltersOpen(false);
                    }}
                    className="w-full gradient-hero"
                  >
                    Aplicar
                  </Button>
                  {adminHasActiveFilters && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setFilterDepartment('all');
                        setFilterManager('all');
                        setFilterStatus('all');
                        setFilterName('');
                        setAppliedFilterDepartment('all');
                        setAppliedFilterManager('all');
                        setAppliedFilterStatus('all');
                        setAppliedFilterName('');
                        setAdminPage(1);
                        setAdminFiltersOpen(false);
                      }}
                    >
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Por página</Label>
          <Select
            value={String(adminPageSize)}
            onValueChange={(v) => {
              setAdminPageSize(Number(v));
              setAdminPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="card-elevated overflow-hidden">
        {isLoadingAdminList ? (
          <div className="overflow-x-auto p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-28" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : adminListWithManagerName.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum resultado encontrado</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Conclusão</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminListWithManagerName.map((row) => (
                    <TableRow key={row.user_id}>
                      <TableCell className="font-medium">{row.name ?? '—'}</TableCell>
                      <TableCell>{row.department ?? '—'}</TableCell>
                      <TableCell>{row.manager_name ?? '—'}</TableCell>
                      <TableCell>{ASSESSMENT_STATUS_LABELS[row.status] ?? row.status}</TableCell>
                      <TableCell>
                        {row.completed_at
                          ? new Date(row.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {row.status === 'completed' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={isDownloading && downloadingUserId === row.user_id}
                            onClick={() => {
                              toast.info(`Baixando relatório de ${row.name ?? 'colaborador'}…`);
                              downloadReport(row.user_id, row.name ?? undefined, row.manager_name);
                            }}
                          >
                            {isDownloading && downloadingUserId === row.user_id ? (
                              <>Gerando…</>
                            ) : (
                              <>
                                <Download className="h-4 w-4" />
                                Baixar PDF
                              </>
                            )}
                          </Button>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                {adminStartRow}–{adminEndRow} de {adminTotalCount}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (adminPage > 1) setAdminPage((p) => p - 1);
                      }}
                      className={adminPage <= 1 || isLoadingAdminList ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  {(() => {
                    const maxVisible = 5;
                    let start = 1;
                    let end = Math.min(maxVisible, adminTotalPages);
                    if (adminTotalPages > maxVisible) {
                      if (adminPage > adminTotalPages - 2) {
                        start = adminTotalPages - 4;
                        end = adminTotalPages;
                      } else if (adminPage > 2) {
                        start = adminPage - 2;
                        end = adminPage + 2;
                      }
                    }
                    return Array.from({ length: end - start + 1 }, (_, i) => {
                      const pageNum = start + i;
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setAdminPage(pageNum);
                            }}
                            isActive={adminPage === pageNum}
                            className={isLoadingAdminList ? 'pointer-events-none' : ''}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    });
                  })()}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (adminPage < adminTotalPages) setAdminPage((p) => p + 1);
                      }}
                      className={adminPage >= adminTotalPages || isLoadingAdminList ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <MainLayout>
      {canSeeAdminList ? (
        <Tabs defaultValue="meu" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="meu">Meu teste</TabsTrigger>
            <TabsTrigger value="admin">Acompanhamento</TabsTrigger>
          </TabsList>
          <TabsContent value="meu" className="mt-4">{mainContent}</TabsContent>
          <TabsContent value="admin" className="mt-4">{adminContent}</TabsContent>
        </Tabs>
      ) : (
        mainContent
      )}
    </MainLayout>
  );
}
