import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Star,
  Calendar,
  TrendingUp,
  MessageSquare,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';

interface Criterion {
  id: string;
  name: string;
  description: string;
  score: number | null;
}

interface Evaluation {
  id: string;
  period: string;
  date: string;
  status: 'completed' | 'pending' | 'in_progress';
  overallScore?: number;
  criteria: Criterion[];
  feedback?: string;
}

const mockEvaluations: Evaluation[] = [
  {
    id: '1',
    period: 'Q4 2024',
    date: '2024-12-15',
    status: 'completed',
    overallScore: 4.2,
    criteria: [
      { id: 'c1', name: 'Qualidade do Trabalho', description: 'Precisão e atenção aos detalhes', score: 4 },
      { id: 'c2', name: 'Colaboração', description: 'Trabalho em equipe e comunicação', score: 5 },
      { id: 'c3', name: 'Proatividade', description: 'Iniciativa e antecipação de problemas', score: 4 },
      { id: 'c4', name: 'Cumprimento de Prazos', description: 'Entrega dentro do cronograma', score: 4 },
      { id: 'c5', name: 'Desenvolvimento Técnico', description: 'Crescimento de habilidades', score: 4 },
    ],
    feedback: 'Excelente desempenho no trimestre. Destaque para a colaboração com o time e qualidade das entregas.'
  },
  {
    id: '2',
    period: 'Q1 2025',
    date: '2025-03-15',
    status: 'pending',
    criteria: [
      { id: 'c1', name: 'Qualidade do Trabalho', description: 'Precisão e atenção aos detalhes', score: null },
      { id: 'c2', name: 'Colaboração', description: 'Trabalho em equipe e comunicação', score: null },
      { id: 'c3', name: 'Proatividade', description: 'Iniciativa e antecipação de problemas', score: null },
      { id: 'c4', name: 'Cumprimento de Prazos', description: 'Entrega dentro do cronograma', score: null },
      { id: 'c5', name: 'Desenvolvimento Técnico', description: 'Crescimento de habilidades', score: null },
    ],
  },
];

const StarRating = ({ score, maxScore = 5, size = 'md', interactive = false, onChange }: { 
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
          disabled={!interactive}
          onClick={() => onChange?.(i + 1)}
          className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
        >
          <Star 
            className={`${sizeClass} ${
              score !== null && i < score 
                ? 'fill-amber-400 text-amber-400' 
                : 'text-muted-foreground/30'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

export default function Evaluation() {
  const { canManageUsers, isHR } = useAuth();
  const isTeamView = canManageUsers();
  const [evaluations] = useState(mockEvaluations);
  const [selectedEval, setSelectedEval] = useState<Evaluation | null>(evaluations[0]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentScores, setCurrentScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState('');

  const handleScoreChange = (criterionId: string, score: number) => {
    setCurrentScores(prev => ({ ...prev, [criterionId]: score }));
  };

  const handleSubmitEvaluation = () => {
    // Mock submit
    console.log('Submitting evaluation:', { scores: currentScores, feedback });
    setIsEvaluating(false);
  };

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {isTeamView ? 'Avaliações de Desempenho' : 'Minhas Avaliações/Feedbacks'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isTeamView
                ? 'Gerencie e realize avaliações periódicas do time'
                : 'Acompanhe seu desempenho e feedback recebido'}
            </p>
          </div>
          {isTeamView && (
            <Button className="gradient-hero">
              <Calendar className="w-4 h-4 mr-2" />
              Nova Avaliação
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Evaluations List */}
          <div className="space-y-3">
            <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide px-1">
              Histórico
            </h2>
            {evaluations.map((evaluation) => (
              <button
                key={evaluation.id}
                onClick={() => { setSelectedEval(evaluation); setIsEvaluating(false); }}
                className={`w-full p-4 rounded-xl border text-left transition-all duration-200 ${
                  selectedEval?.id === evaluation.id
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border bg-card hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground">{evaluation.period}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    evaluation.status === 'completed'
                      ? 'bg-primary/10 text-primary'
                      : evaluation.status === 'in_progress'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {evaluation.status === 'completed' ? 'Concluída' : 
                     evaluation.status === 'in_progress' ? 'Em andamento' : 'Pendente'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {new Date(evaluation.date).toLocaleDateString('pt-BR')}
                  </span>
                  {evaluation.overallScore && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-foreground">{evaluation.overallScore}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Evaluation Details */}
          <div className="lg:col-span-2 card-elevated p-6">
            {selectedEval ? (
              <>
                <div className="flex items-start justify-between mb-6 pb-6 border-b border-border">
                  <div>
                    <h2 className="text-xl font-display font-semibold text-foreground">
                      Avaliação {selectedEval.period}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      {selectedEval.status === 'completed' 
                        ? 'Avaliação concluída'
                        : 'Avaliação pendente - prazo: ' + new Date(selectedEval.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  {selectedEval.overallScore && (
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary">{selectedEval.overallScore}</div>
                      <StarRating score={Math.round(selectedEval.overallScore)} size="sm" />
                    </div>
                  )}
                </div>

                {/* Criteria */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Critérios de Avaliação
                  </h3>
                  
                  {selectedEval.criteria.map((criterion) => (
                    <div 
                      key={criterion.id}
                      className="p-4 rounded-xl bg-muted/30 border border-border"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{criterion.name}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">{criterion.description}</p>
                        </div>
                        <StarRating 
                          score={isEvaluating ? (currentScores[criterion.id] || null) : criterion.score}
                          interactive={isEvaluating}
                          onChange={(score) => handleScoreChange(criterion.id, score)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Feedback */}
                {(selectedEval.feedback || isEvaluating) && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <h3 className="font-medium text-foreground flex items-center gap-2 mb-4">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      Feedback
                    </h3>
                    {isEvaluating ? (
                      <Textarea 
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Escreva um feedback construtivo para o colaborador..."
                        className="min-h-[120px]"
                      />
                    ) : (
                      <p className="text-muted-foreground bg-muted/30 p-4 rounded-xl">
                        {selectedEval.feedback}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                {isTeamView && selectedEval.status === 'pending' && (
                  <div className="mt-6 pt-6 border-t border-border flex gap-3">
                    {isEvaluating ? (
                      <>
                        <Button variant="outline" onClick={() => setIsEvaluating(false)}>
                          Cancelar
                        </Button>
                        <Button className="gradient-hero flex-1" onClick={handleSubmitEvaluation}>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Enviar Avaliação
                        </Button>
                      </>
                    ) : (
                      <Button className="gradient-hero w-full" onClick={() => setIsEvaluating(true)}>
                        Realizar Avaliação
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Selecione uma avaliação para ver os detalhes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
