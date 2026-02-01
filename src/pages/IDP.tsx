import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  useIDPPlans,
  useIDPPlan,
  useCreateIDPPlan,
  useToggleIDPAction,
} from '@/hooks/useIDP';
import { useEmployeesForAssign } from '@/hooks/useOnboarding';
import {
  Target,
  CheckCircle2,
  Circle,
  Calendar,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

export default function IDP() {
  const { user, canManageUsers } = useAuth();
  const isTeamView = canManageUsers();
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  const [newObjectiveTitle, setNewObjectiveTitle] = useState('');
  const [newActionTitle, setNewActionTitle] = useState('');

  const profileId = isTeamView ? selectedProfileId : (user?.id ?? '');
  const { data: plans = [] } = useIDPPlans(profileId || undefined);
  const { data: planDetail } = useIDPPlan(selectedPlanId);
  const { data: employees } = useEmployeesForAssign();
  const createMutation = useCreateIDPPlan();
  const toggleMutation = useToggleIDPAction();

  const handleCreate = () => {
    const pid = isTeamView ? selectedProfileId : user?.id;
    if (!pid) {
      toast.error('Selecione um colaborador');
      return;
    }
    if (!newTitle.trim()) {
      toast.error('Informe o título do PDI');
      return;
    }
    const objectives =
      newObjectiveTitle.trim() || newActionTitle.trim()
        ? [
            {
              title: newObjectiveTitle.trim() || 'Objetivo de desenvolvimento',
              actions: newActionTitle.trim() ? [{ title: newActionTitle.trim() }] : [],
            },
          ]
        : [];

    createMutation.mutate(
      {
        profileId: pid,
        title: newTitle.trim(),
        periodStart: newPeriodStart || undefined,
        periodEnd: newPeriodEnd || undefined,
        objectives,
      },
      {
        onSuccess: (planId) => {
          toast.success('PDI criado com sucesso');
          setShowCreateDialog(false);
          setNewTitle('');
          setNewPeriodStart('');
          setNewPeriodEnd('');
          setNewObjectiveTitle('');
          setNewActionTitle('');
          setSelectedPlanId(planId);
        },
        onError: () => toast.error('Erro ao criar PDI'),
      }
    );
  };

  const handleToggleAction = (actionId: string, completed: boolean) => {
    toggleMutation.mutate(
      { actionId, completed },
      {
        onSuccess: () => toast.success(completed ? 'Ação concluída' : 'Ação reaberta'),
        onError: () => toast.error('Erro ao atualizar'),
      }
    );
  };

  const plan = planDetail ?? null;
  const totalActions = plan?.objectives?.reduce((acc, o) => acc + o.actions.length, 0) ?? 0;
  const completedActions =
    plan?.objectives?.reduce((acc, o) => acc + o.actions.filter((a) => a.status === 'completed').length, 0) ?? 0;
  const progressPercent = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

  if (isTeamView && !selectedProfileId) {
    return (
      <MainLayout>
        <div className="max-w-4xl animate-fade-in">
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold text-foreground">
              PDI - Plano de Desenvolvimento Individual
            </h1>
            <p className="text-muted-foreground mt-1">
              Selecione um colaborador para gerenciar PDIs
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
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!profileId) {
    return (
      <MainLayout>
        <div className="card-elevated p-12 text-center text-muted-foreground">
          Carregando...
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl animate-fade-in">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {isTeamView ? `PDI - ${employees?.find((e) => e.id === selectedProfileId)?.name ?? 'Colaborador'}` : 'Meu PDI'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isTeamView
                ? 'Gerencie os planos de desenvolvimento'
                : 'Acompanhe seus objetivos e ações de desenvolvimento'}
            </p>
          </div>
          <Button className="gradient-hero" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo PDI
          </Button>
        </div>

        {plans.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              {isTeamView ? 'Nenhum PDI criado para este colaborador' : 'Você ainda não possui um PDI'}
            </p>
            <Button className="gradient-hero" onClick={() => setShowCreateDialog(true)}>
              Criar primeiro PDI
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                Planos
              </h2>
              {plans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`w-full p-4 rounded-xl border text-left transition-all duration-200 ${
                    selectedPlanId === p.id
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border bg-card hover:border-muted-foreground/30'
                  }`}
                >
                  <p className="font-semibold text-foreground">{p.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {p.period_start && p.period_end
                      ? `${new Date(p.period_start).toLocaleDateString('pt-BR')} - ${new Date(p.period_end).toLocaleDateString('pt-BR')}`
                      : 'Sem período definido'}
                  </p>
                  <span
                    className={`mt-2 inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      p.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {p.status === 'active' ? 'Ativo' : p.status}
                  </span>
                </button>
              ))}
            </div>

            <div className="lg:col-span-2 card-elevated p-6">
              {plan ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-display font-semibold text-foreground">{plan.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {plan.period_start && plan.period_end
                          ? `${new Date(plan.period_start).toLocaleDateString('pt-BR')} - ${new Date(plan.period_end).toLocaleDateString('pt-BR')}`
                          : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
                      <p className="text-xs text-muted-foreground">
                        {completedActions} de {totalActions} ações
                      </p>
                    </div>
                  </div>

                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full gradient-hero rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="space-y-6">
                    {(plan.objectives ?? []).map((obj) => (
                      <div key={obj.id} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold text-foreground">{obj.title}</h3>
                          {obj.description && (
                            <p className="text-sm text-muted-foreground">{obj.description}</p>
                          )}
                        </div>
                        <div className="space-y-2 pl-7">
                          {(obj.actions ?? []).map((action) => (
                            <div
                              key={action.id}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                action.status === 'completed'
                                  ? 'border-primary/30 bg-primary/5'
                                  : 'border-border bg-muted/30'
                              }`}
                            >
                              <button
                                onClick={() =>
                                  handleToggleAction(action.id, action.status !== 'completed')
                                }
                                disabled={toggleMutation.isPending}
                                className="flex-shrink-0"
                              >
                                {action.status === 'completed' ? (
                                  <CheckCircle2 className="w-5 h-5 text-primary" />
                                ) : (
                                  <Circle className="w-5 h-5 text-muted-foreground" />
                                )}
                              </button>
                              <span
                                className={`flex-1 ${action.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                              >
                                {action.title}
                              </span>
                              {action.due_date && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(action.due_date).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione um plano para ver os detalhes</p>
                </div>
              )}
            </div>
          </div>
        )}

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo PDI</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Desenvolvimento 2025"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input
                    type="date"
                    value={newPeriodStart}
                    onChange={(e) => setNewPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input
                    type="date"
                    value={newPeriodEnd}
                    onChange={(e) => setNewPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Primeiro objetivo (opcional)</Label>
                <Input
                  value={newObjectiveTitle}
                  onChange={(e) => setNewObjectiveTitle(e.target.value)}
                  placeholder="Ex: Desenvolver habilidades de liderança"
                />
              </div>
              <div className="space-y-2">
                <Label>Primeira ação (opcional)</Label>
                <Input
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                  placeholder="Ex: Participar do curso de liderança"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button
                className="gradient-hero"
                onClick={handleCreate}
                disabled={createMutation.isPending || !newTitle.trim()}
              >
                {createMutation.isPending ? 'Criando...' : 'Criar PDI'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
