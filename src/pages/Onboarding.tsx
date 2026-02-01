import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useOnboarding,
  useTeamOnboarding,
  useAssignOnboarding,
  useOnboardingTemplates,
  useEmployeesForAssign,
} from '@/hooks/useOnboarding';
import {
  FileText,
  Video,
  Users,
  Briefcase,
  CheckCircle2,
  Clock,
  ChevronRight,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

const STEP_ICONS = [FileText, Video, Users, Briefcase] as const;

export default function Onboarding() {
  const { canManageUsers, isHR } = useAuth();
  const isTeamView = canManageUsers();
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignProfileId, setAssignProfileId] = useState<string>('');
  const [assignTemplateId, setAssignTemplateId] = useState<string>('');

  const {
    assignment,
    steps,
    completedCount,
    totalTasks,
    progressPercent,
    isLoading,
    toggleTask,
    isToggling,
  } = useOnboarding();

  const { employees, isLoading: teamLoading } = useTeamOnboarding();
  const { data: templates } = useOnboardingTemplates();
  const { data: employeesList } = useEmployeesForAssign();
  const assignMutation = useAssignOnboarding();

  const handleAssign = () => {
    if (!assignProfileId || !assignTemplateId) {
      toast.error('Selecione colaborador e template');
      return;
    }
    assignMutation.mutate(
      { profileId: assignProfileId, templateId: assignTemplateId },
      {
        onSuccess: () => {
          toast.success('Onboarding atribuído com sucesso');
          setShowAssignDialog(false);
          setAssignProfileId('');
          setAssignTemplateId('');
        },
        onError: () => toast.error('Erro ao atribuir onboarding'),
      }
    );
  };

  const [activeStep, setActiveStep] = useState<typeof steps[0] | null>(null);

  if (isTeamView) {
    return (
      <MainLayout>
        <div className="space-y-8 animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                {isHR() ? 'Gerenciar Onboarding' : 'Onboarding da Equipe'}
              </h1>
              <p className="text-muted-foreground mt-1">
                Acompanhe o progresso de integração dos colaboradores
              </p>
            </div>
            {isHR() && (
              <Button className="gradient-hero" onClick={() => setShowAssignDialog(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Atribuir Onboarding
              </Button>
            )}
          </div>

          {teamLoading ? (
            <div className="card-elevated p-12 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : employees.length === 0 ? (
            <div className="card-elevated p-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum colaborador em onboarding</p>
              {isHR() && (
                <Button className="mt-4 gradient-hero" onClick={() => setShowAssignDialog(true)}>
                  Atribuir primeiro onboarding
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full gradient-hero flex items-center justify-center text-white font-semibold">
                    {emp.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{emp.name}</p>
                    <p className="text-sm text-muted-foreground">{emp.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{emp.progress_percent}%</p>
                    <div className="w-20 h-2 bg-muted rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full gradient-hero rounded-full transition-all duration-500"
                        style={{ width: `${emp.progress_percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Atribuir Onboarding</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Colaborador</Label>
                  <Select value={assignProfileId} onValueChange={setAssignProfileId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      {(employeesList ?? []).map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name} ({e.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={assignTemplateId} onValueChange={setAssignTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o template" />
                    </SelectTrigger>
                    <SelectContent>
                      {(templates ?? []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  className="gradient-hero"
                  onClick={handleAssign}
                  disabled={assignMutation.isPending || !assignProfileId || !assignTemplateId}
                >
                  {assignMutation.isPending ? 'Salvando...' : 'Atribuir'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="card-elevated p-12 text-center text-muted-foreground">
          Carregando onboarding...
        </div>
      </MainLayout>
    );
  }

  if (!assignment) {
    return (
      <MainLayout>
        <div className="card-elevated p-12 text-center">
          <FileText className="w-16 h-16 mx-auto mb-6 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-display font-semibold text-foreground mb-2">
            Onboarding não atribuído
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Entre em contato com o RH para receber seu plano de onboarding.
          </p>
        </div>
      </MainLayout>
    );
  }

  const currentActiveStep = activeStep ?? steps[0];
  const IconForStep = (idx: number) => STEP_ICONS[idx % STEP_ICONS.length];

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Meu Onboarding
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete as etapas para sua integração completa
          </p>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold text-foreground">Progresso Geral</h2>
              <p className="text-sm text-muted-foreground">
                {completedCount} de {totalTasks} tarefas concluídas
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-primary">{progressPercent}%</span>
            </div>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full gradient-hero rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            {steps.map((step, idx) => {
              const Icon = IconForStep(idx);
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step)}
                  className={`w-full p-4 rounded-xl border text-left transition-all duration-200 ${
                    currentActiveStep?.id === step.id
                      ? 'border-primary bg-primary/5 shadow-md'
                      : step.completed
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-card hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        step.completed
                          ? 'gradient-hero text-white'
                          : step.current
                            ? 'gradient-accent text-white'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {step.completed ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-medium ${step.completed ? 'text-primary' : 'text-foreground'}`}
                        >
                          {step.title}
                        </p>
                        {step.current && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent/20 text-accent">
                            Atual
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {step.description ?? ''}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-2 card-elevated p-6">
            {currentActiveStep ? (
              <>
                <div className="flex items-start gap-4 mb-6 pb-6 border-b border-border">
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                      currentActiveStep.completed
                        ? 'gradient-hero text-white'
                        : currentActiveStep.current
                          ? 'gradient-accent text-white'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {React.createElement(IconForStep(steps.indexOf(currentActiveStep)), { className: 'w-7 h-7' })}
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-semibold text-foreground">
                      {currentActiveStep.title}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      {currentActiveStep.description ?? ''}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium text-foreground mb-4">Tarefas</h3>
                  {currentActiveStep.tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
                        task.completed
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      <button
                        onClick={() =>
                          toggleTask({
                            taskId: task.id,
                            completed: !task.completed,
                          })
                        }
                        disabled={isToggling}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                          task.completed
                            ? 'border-primary bg-primary text-white'
                            : 'border-muted-foreground/30 hover:border-primary'
                        }`}
                      >
                        {task.completed && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                      <span
                        className={`flex-1 ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                      >
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
