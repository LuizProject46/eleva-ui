import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { ProgressSteps } from '@/components/ui/progress-steps';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Video, 
  Users, 
  Briefcase,
  CheckCircle2,
  Clock,
  ChevronRight
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
  current?: boolean;
  tasks: { id: string; title: string; completed: boolean }[];
}

const initialSteps: OnboardingStep[] = [
  {
    id: '1',
    title: 'Documentação Inicial',
    description: 'Envio de documentos e preenchimento de formulários obrigatórios',
    icon: FileText,
    completed: true,
    tasks: [
      { id: '1a', title: 'Contrato de trabalho', completed: true },
      { id: '1b', title: 'Documentos pessoais', completed: true },
      { id: '1c', title: 'Dados bancários', completed: true },
    ]
  },
  {
    id: '2',
    title: 'Treinamento Institucional',
    description: 'Conhecer a cultura, valores e políticas da empresa',
    icon: Video,
    completed: true,
    tasks: [
      { id: '2a', title: 'Vídeo institucional', completed: true },
      { id: '2b', title: 'Código de conduta', completed: true },
      { id: '2c', title: 'Políticas de segurança', completed: true },
    ]
  },
  {
    id: '3',
    title: 'Conhecer a Equipe',
    description: 'Integração com colegas e liderança direta',
    icon: Users,
    completed: false,
    current: true,
    tasks: [
      { id: '3a', title: 'Reunião com gestor', completed: true },
      { id: '3b', title: 'Apresentação ao time', completed: false },
      { id: '3c', title: 'Café virtual com mentores', completed: false },
    ]
  },
  {
    id: '4',
    title: 'Primeiro Projeto',
    description: 'Participação em uma atividade prática supervisionada',
    icon: Briefcase,
    completed: false,
    tasks: [
      { id: '4a', title: 'Definir projeto inicial', completed: false },
      { id: '4b', title: 'Acompanhamento semanal', completed: false },
      { id: '4c', title: 'Avaliação de conclusão', completed: false },
    ]
  },
];

export default function Onboarding() {
  const { user } = useAuth();
  const isHR = user?.role === 'hr';
  const [steps, setSteps] = useState(initialSteps);
  const [selectedStep, setSelectedStep] = useState<OnboardingStep | null>(steps.find(s => s.current) || null);

  const handleTaskToggle = (stepId: string, taskId: string) => {
    setSteps(prev => prev.map(step => {
      if (step.id === stepId) {
        const updatedTasks = step.tasks.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        );
        const allCompleted = updatedTasks.every(t => t.completed);
        return { ...step, tasks: updatedTasks, completed: allCompleted };
      }
      return step;
    }));
  };

  const completedSteps = steps.filter(s => s.completed).length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {isHR ? 'Gerenciar Onboarding' : 'Meu Onboarding'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isHR 
                ? 'Acompanhe o progresso de integração dos colaboradores'
                : 'Complete as etapas para sua integração completa'}
            </p>
          </div>
          {isHR && (
            <Button className="gradient-hero">
              <Users className="w-4 h-4 mr-2" />
              Novo Colaborador
            </Button>
          )}
        </div>

        {/* Progress Overview */}
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold text-foreground">Progresso Geral</h2>
              <p className="text-sm text-muted-foreground">{completedSteps} de {steps.length} etapas concluídas</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-primary">{Math.round(progress)}%</span>
            </div>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full gradient-hero rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Steps List */}
          <div className="lg:col-span-1 space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.id}
                  onClick={() => setSelectedStep(step)}
                  className={`w-full p-4 rounded-xl border text-left transition-all duration-200 ${
                    selectedStep?.id === step.id
                      ? 'border-primary bg-primary/5 shadow-md'
                      : step.completed
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-card hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      step.completed
                        ? 'gradient-hero text-white'
                        : step.current
                          ? 'gradient-accent text-white'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {step.completed ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${step.completed ? 'text-primary' : 'text-foreground'}`}>
                          {step.title}
                        </p>
                        {step.current && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent/20 text-accent">
                            Atual
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {step.description}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Step Details */}
          <div className="lg:col-span-2 card-elevated p-6">
            {selectedStep ? (
              <>
                <div className="flex items-start gap-4 mb-6 pb-6 border-b border-border">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    selectedStep.completed
                      ? 'gradient-hero text-white'
                      : selectedStep.current
                        ? 'gradient-accent text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    <selectedStep.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-semibold text-foreground">
                      {selectedStep.title}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      {selectedStep.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium text-foreground mb-4">Tarefas</h3>
                  {selectedStep.tasks.map((task) => (
                    <div 
                      key={task.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
                        task.completed
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      <button
                        onClick={() => handleTaskToggle(selectedStep.id, task.id)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                          task.completed
                            ? 'border-primary bg-primary text-white'
                            : 'border-muted-foreground/30 hover:border-primary'
                        }`}
                      >
                        {task.completed && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                      <span className={`flex-1 ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {task.title}
                      </span>
                      {task.completed ? (
                        <span className="text-xs text-primary font-medium">Concluído</span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {!selectedStep.completed && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <Button className="w-full gradient-hero">
                      Marcar Etapa como Concluída
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Selecione uma etapa para ver os detalhes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
