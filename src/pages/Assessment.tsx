import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDiscQuestions, useCreateDiscAssessment, useDiscAssessmentsByProfile, type DiscValue } from '@/hooks/useDisc';
import { useEmployeesForAssign } from '@/hooks/useOnboarding';
import {
  Brain,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Zap,
  Users,
  BarChart3,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

const discProfiles: Record<
  DiscValue,
  {
    name: string;
    color: string;
    icon: typeof Zap;
    traits: string[];
    description: string;
  }
> = {
  D: {
    name: 'Dominância',
    color: 'from-red-500 to-orange-500',
    icon: Zap,
    traits: ['Direto', 'Decisivo', 'Orientado a resultados', 'Competitivo'],
    description:
      'Você é movido por desafios e resultados. Tem facilidade para tomar decisões rápidas e liderar equipes em direção a objetivos claros.',
  },
  I: {
    name: 'Influência',
    color: 'from-amber-400 to-yellow-500',
    icon: Users,
    traits: ['Entusiasta', 'Comunicativo', 'Persuasivo', 'Otimista'],
    description:
      'Você tem excelentes habilidades interpessoais e consegue motivar e influenciar pessoas. Sua energia positiva contagia o ambiente.',
  },
  S: {
    name: 'Estabilidade',
    color: 'from-emerald-500 to-teal-500',
    icon: Shield,
    traits: ['Paciente', 'Confiável', 'Cooperativo', 'Bom ouvinte'],
    description:
      'Você valoriza harmonia e consistência. É um excelente colaborador que contribui para um ambiente de trabalho estável e produtivo.',
  },
  C: {
    name: 'Conformidade',
    color: 'from-blue-500 to-indigo-500',
    icon: BarChart3,
    traits: ['Analítico', 'Preciso', 'Sistemático', 'Cauteloso'],
    description:
      'Você tem uma mente analítica e valoriza qualidade e precisão. Excelente em tarefas que exigem atenção aos detalhes e planejamento.',
  },
};

const EVALUATOR_LABELS: Record<string, string> = {
  self: 'Autoavaliação',
  manager: 'Avaliação do Gestor',
  hr: 'Avaliação do RH',
};

export default function Assessment() {
  const { user, canManageUsers, isHR } = useAuth();
  const isTeamView = canManageUsers();
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DiscValue>>({});
  const [showResult, setShowResult] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  const { data: questions = [] } = useDiscQuestions();
  const { data: employees } = useEmployeesForAssign();
  const createMutation = useCreateDiscAssessment();
  const profileId = isTeamView ? selectedProfileId : (user?.id ?? '');
  const evaluatorType: 'self' | 'manager' | 'hr' = isTeamView ? (isHR() ? 'hr' : 'manager') : 'self';
  const { data: pastAssessments } = useDiscAssessmentsByProfile(profileId || undefined, {
    enabled: !!profileId && (showResult || isTeamView),
  });

  const handleAnswer = (questionId: string, value: DiscValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    } else {
      setShowResult(true);
      if (profileId && Object.keys(answers).length === questions.length) {
        createMutation.mutate(
          { profileId, evaluatorType, answers },
          {
            onSuccess: () => toast.success('Avaliação salva com sucesso'),
            onError: () => toast.error('Erro ao salvar avaliação'),
          }
        );
      }
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  };

  const calculateResult = (): DiscValue => {
    const counts = { D: 0, I: 0, S: 0, C: 0 };
    Object.values(answers).forEach((value) => {
      counts[value]++;
    });
    return (['D', 'I', 'S', 'C'] as const).reduce((a, b) => (counts[a] >= counts[b] ? a : b));
  };

  const progress = questions.length > 0 ? ((currentQuestion + 1) / questions.length) * 100 : 0;
  const currentQ = questions[currentQuestion];
  const result = showResult ? discProfiles[calculateResult()] : null;
  const ResultIcon = result?.icon || Brain;

  if (isTeamView && !selectedProfileId) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto animate-fade-in">
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold text-foreground">
              Perfis DISC
            </h1>
            <p className="text-muted-foreground mt-1">
              Selecione um colaborador para realizar a avaliação DISC
            </p>
          </div>
          <div className="space-y-4">
            <Label>Colaborador</Label>
            <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {(employees ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pastAssessments && pastAssessments.length > 0 && (
              <div className="mt-6 card-elevated p-6">
                <h3 className="font-semibold text-foreground mb-4">Histórico de avaliações</h3>
                <p className="text-sm text-muted-foreground">
                  Selecione um colaborador para ver ou realizar avaliações
                </p>
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (showIntro && !showResult && currentQuestion === 0 && Object.keys(answers).length === 0 && questions.length > 0) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-6">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Teste Comportamental DISC
            </h1>
            <p className="text-muted-foreground mt-2">
              {isTeamView
                ? `Avalie o perfil comportamental de ${employees?.find((e) => e.id === selectedProfileId)?.name ?? 'o colaborador'}`
                : 'Descubra seu perfil comportamental e entenda seus pontos fortes'}
            </p>
          </div>

          <div className="card-elevated p-8 text-center">
            <div className="grid grid-cols-2 gap-4 mb-8">
              {Object.entries(discProfiles).map(([key, profile]) => {
                const Icon = profile.icon;
                return (
                  <div key={key} className="p-4 rounded-xl bg-muted/30">
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-r ${profile.color} flex items-center justify-center mx-auto mb-2`}
                    >
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
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  Responda {questions.length} perguntas sobre comportamento
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  Escolha a opção que mais se parece
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  Receba o perfil DISC detalhado
                </li>
              </ul>
            </div>

            <Button
              className="w-full gradient-hero py-6 text-lg"
              onClick={() => {
                setShowIntro(false);
                setCurrentQuestion(0);
              }}
            >
              Iniciar Teste
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>

            <p className="text-xs text-muted-foreground mt-4">Tempo estimado: 5 minutos</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (showResult && result) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto animate-fade-in">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <CheckCircle2 className="w-6 h-6 text-primary" />
              <span className="text-primary font-medium">Teste Concluído</span>
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {isTeamView ? `Perfil DISC - ${EVALUATOR_LABELS[evaluatorType]}` : 'Seu Perfil DISC'}
            </h1>
          </div>

          <div className="card-elevated p-8">
            <div className="text-center mb-8">
              <div
                className={`w-24 h-24 rounded-2xl bg-gradient-to-r ${result.color} flex items-center justify-center mx-auto mb-4`}
              >
                <ResultIcon className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">{result.name}</h2>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">{result.description}</p>
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
              {(Object.entries(discProfiles) as [DiscValue, typeof discProfiles.D][]).map(([key, profile]) => {
                const count = Object.values(answers).filter((v) => v === key).length;
                const percentage = questions.length > 0 ? (count / questions.length) * 100 : 0;
                return (
                  <div key={key} className="text-center">
                    <div className="w-full h-2 rounded-full bg-muted mb-2 overflow-hidden">
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

            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowResult(false);
                  setCurrentQuestion(0);
                  setAnswers({});
                  setShowIntro(true);
                }}
              >
                Refazer Teste
              </Button>
              <Button className="flex-1 gradient-hero">Baixar Relatório</Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (questions.length === 0) {
    return (
      <MainLayout>
        <div className="card-elevated p-12 text-center text-muted-foreground">
          Carregando perguntas...
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Pergunta {currentQuestion + 1} de {questions.length}
            </span>
            <span className="text-sm font-medium text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="card-elevated p-8">
          <h2 className="text-xl font-display font-semibold text-foreground mb-6">{currentQ.text}</h2>

          <div className="space-y-3">
            {(currentQ.options as { value: DiscValue; text: string }[]).map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswer(currentQ.id, option.value)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  answers[currentQ.id] === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      answers[currentQ.id] === option.value ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                    }`}
                  >
                    {answers[currentQ.id] === option.value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <span
                    className={
                      answers[currentQ.id] === option.value ? 'text-primary font-medium' : 'text-foreground'
                    }
                  >
                    {option.text}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-4 mt-8">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>
            <Button
              className="flex-1 gradient-hero"
              onClick={handleNext}
              disabled={!answers[currentQ.id]}
            >
              {currentQuestion === questions.length - 1 ? 'Ver Resultado' : 'Próxima'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
