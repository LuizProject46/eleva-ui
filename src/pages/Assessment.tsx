import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Brain,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Zap,
  Users,
  BarChart3,
  Shield
} from 'lucide-react';

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
    ]
  },
  {
    id: '2',
    text: 'Quando surge um problema, sua primeira reação é:',
    options: [
      { value: 'D', text: 'Agir imediatamente para resolver' },
      { value: 'I', text: 'Discutir com colegas e buscar ideias' },
      { value: 'S', text: 'Avaliar o impacto nas pessoas envolvidas' },
      { value: 'C', text: 'Coletar informações antes de decidir' },
    ]
  },
  {
    id: '3',
    text: 'Você se sente mais motivado quando:',
    options: [
      { value: 'D', text: 'Tem desafios e metas audaciosas' },
      { value: 'I', text: 'Pode se expressar e receber reconhecimento' },
      { value: 'S', text: 'Tem um ambiente harmonioso e previsível' },
      { value: 'C', text: 'Pode trabalhar com precisão e qualidade' },
    ]
  },
  {
    id: '4',
    text: 'Em reuniões de equipe, você geralmente:',
    options: [
      { value: 'D', text: 'Lidera a discussão e propõe soluções' },
      { value: 'I', text: 'Anima o grupo e traz energia' },
      { value: 'S', text: 'Ouve atentamente e busca consenso' },
      { value: 'C', text: 'Faz perguntas detalhadas e analíticas' },
    ]
  },
  {
    id: '5',
    text: 'Seu maior ponto forte no trabalho é:',
    options: [
      { value: 'D', text: 'Determinação e foco em resultados' },
      { value: 'I', text: 'Comunicação e entusiasmo' },
      { value: 'S', text: 'Paciência e confiabilidade' },
      { value: 'C', text: 'Precisão e atenção aos detalhes' },
    ]
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

export default function Assessment() {
  const { user } = useAuth();
  const isHR = user?.role === 'hr';
  const [hasCompleted, setHasCompleted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'D' | 'I' | 'S' | 'C'>>({});
  const [showResult, setShowResult] = useState(false);

  const handleAnswer = (questionId: string, value: 'D' | 'I' | 'S' | 'C') => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentQuestion < discQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setShowResult(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const calculateResult = () => {
    const counts = { D: 0, I: 0, S: 0, C: 0 };
    Object.values(answers).forEach(value => {
      counts[value]++;
    });
    const dominant = (Object.keys(counts) as Array<'D' | 'I' | 'S' | 'C'>).reduce((a, b) => 
      counts[a] > counts[b] ? a : b
    );
    return dominant;
  };

  const progress = ((currentQuestion + 1) / discQuestions.length) * 100;
  const currentQ = discQuestions[currentQuestion];
  const result = showResult ? discProfiles[calculateResult()] : null;
  const ResultIcon = result?.icon || Brain;

  if (!hasCompleted && !showResult && currentQuestion === 0 && Object.keys(answers).length === 0) {
    // Introduction screen
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
              Descubra seu perfil comportamental e entenda seus pontos fortes
            </p>
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

            <Button 
              className="w-full gradient-hero py-6 text-lg"
              onClick={() => setCurrentQuestion(0)}
            >
              Iniciar Teste
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>

            <p className="text-xs text-muted-foreground mt-4">
              Tempo estimado: 5 minutos
            </p>
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

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => {
                setShowResult(false);
                setCurrentQuestion(0);
                setAnswers({});
              }}>
                Refazer Teste
              </Button>
              <Button className="flex-1 gradient-hero">
                Baixar Relatório
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
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
                className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  answers[currentQ.id] === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    answers[currentQ.id] === option.value
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
              {currentQuestion === discQuestions.length - 1 ? 'Ver Resultado' : 'Próxima'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
