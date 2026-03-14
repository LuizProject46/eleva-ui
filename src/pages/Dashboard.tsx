import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/ui/stat-card';
import { MotivationalQuote } from '@/components/dashboard/MotivationalQuote';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useTotalCollaborators,
  useTeamSize,
  useTotalPdis,
  useActivePdis,
  useOverdueActionPlans,
  useCloseToDeadlineActionPlans,
  useRecentActivity,
  useEmployeePdiSummary,
  useEvaluationCounts,
} from '@/hooks/useDashboardMetrics';
import type { DashboardRecentActivityItem } from '@/types/dashboard';
import {
  ClipboardCheck,
  Users,
  TrendingUp,
  ChevronRight,
  Star,
  FileText,
  Clock,
  CalendarClock,
  MessageSquare,
  Send,
  UserCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const CLOSE_TO_DEADLINE_DAYS = 7;

function formatActivityDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

function getInitial(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function StatCardSkeleton() {
  return (
    <div className="card-interactive p-6 flex items-start justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-12 w-12 rounded-xl" />
    </div>
  );
}

function RecentActivitySkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
          <Skeleton className="w-12 h-12 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface StatCardWithStateProps {
  title: string;
  value: number | null;
  icon: React.ReactNode;
  variant?: 'primary' | 'default';
  isLoading: boolean;
  error: string | null;
  onRetry: () => Promise<void>;
}

function StatCardWithState({
  title,
  value,
  icon,
  variant,
  isLoading,
  error,
  onRetry,
}: StatCardWithStateProps) {
  if (isLoading) return <StatCardSkeleton />;
  if (error) {
    return (
      <div className="card-interactive p-6 flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }
  return (
    <StatCard
      title={title}
      value={value ?? 0}
      icon={icon}
      variant={variant}
    />
  );
}

export default function Dashboard() {
  const { user, canManageUsers, isHR } = useAuth();
  const showTeamView = canManageUsers();

  const totalCollaborators = useTotalCollaborators();
  const teamSize = useTeamSize();
  const totalPdis = useTotalPdis();
  const activePdis = useActivePdis();
  const overdueActionPlans = useOverdueActionPlans();
  const closeToDeadlineActionPlans = useCloseToDeadlineActionPlans();
  const recentActivity = useRecentActivity();
  const employeePdiSummary = useEmployeePdiSummary();
  const evaluationCounts = useEvaluationCounts();

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Olá, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {showTeamView
              ? isHR()
                ? 'Aqui está o resumo do seu time hoje.'
                : 'Acompanhe sua equipe e o progresso do time.'
              : 'Veja seu progresso e próximas atividades.'}
          </p>
        </div>

        {showTeamView ? (
          /* HR / Manager Dashboard */
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {isHR() && (
                <>
                  <StatCardWithState
                    title="Colaboradores Ativos"
                    value={totalCollaborators.data}
                    icon={<Users className="w-6 h-6" />}
                    variant="primary"
                    isLoading={totalCollaborators.isLoading}
                    error={totalCollaborators.error}
                    onRetry={totalCollaborators.refetch}
                  />
                  <StatCardWithState
                    title="Total de PDIs"
                    value={totalPdis.data}
                    icon={<FileText className="w-6 h-6" />}
                    isLoading={totalPdis.isLoading}
                    error={totalPdis.error}
                    onRetry={totalPdis.refetch}
                  />
                  <StatCardWithState
                    title="PDIs Ativos"
                    value={activePdis.data}
                    icon={<ClipboardCheck className="w-6 h-6" />}
                    isLoading={activePdis.isLoading}
                    error={activePdis.error}
                    onRetry={activePdis.refetch}
                  />
                  <StatCardWithState
                    title="Planos Atrasados"
                    value={overdueActionPlans.data}
                    icon={<Clock className="w-6 h-6" />}
                    isLoading={overdueActionPlans.isLoading}
                    error={overdueActionPlans.error}
                    onRetry={overdueActionPlans.refetch}
                  />
                  <StatCardWithState
                    title={`Próximos ${CLOSE_TO_DEADLINE_DAYS} dias`}
                    value={closeToDeadlineActionPlans.data}
                    icon={<CalendarClock className="w-6 h-6" />}
                    isLoading={closeToDeadlineActionPlans.isLoading}
                    error={closeToDeadlineActionPlans.error}
                    onRetry={closeToDeadlineActionPlans.refetch}
                  />
                </>
              )}
              {user?.role === 'manager' && (
                <>
                  <StatCardWithState
                    title="Colaboradores na equipe"
                    value={teamSize.data}
                    icon={<Users className="w-6 h-6" />}
                    variant="primary"
                    isLoading={teamSize.isLoading}
                    error={teamSize.error}
                    onRetry={teamSize.refetch}
                  />
                  <StatCardWithState
                    title="PDIs da equipe"
                    value={totalPdis.data}
                    icon={<FileText className="w-6 h-6" />}
                    isLoading={totalPdis.isLoading}
                    error={totalPdis.error}
                    onRetry={totalPdis.refetch}
                  />
                  <StatCardWithState
                    title="PDIs Ativos"
                    value={activePdis.data}
                    icon={<ClipboardCheck className="w-6 h-6" />}
                    isLoading={activePdis.isLoading}
                    error={activePdis.error}
                    onRetry={activePdis.refetch}
                  />
                  <StatCardWithState
                    title="Planos Atrasados"
                    value={overdueActionPlans.data}
                    icon={<Clock className="w-6 h-6" />}
                    isLoading={overdueActionPlans.isLoading}
                    error={overdueActionPlans.error}
                    onRetry={overdueActionPlans.refetch}
                  />
                  <StatCardWithState
                    title={`Próximos ${CLOSE_TO_DEADLINE_DAYS} dias`}
                    value={closeToDeadlineActionPlans.data}
                    icon={<CalendarClock className="w-6 h-6" />}
                    isLoading={closeToDeadlineActionPlans.isLoading}
                    error={closeToDeadlineActionPlans.error}
                    onRetry={closeToDeadlineActionPlans.refetch}
                  />
                </>
              )}
            </div>

            {/* Avaliações e Feedbacks (HR / Manager) — between totals and PDIs resume */}
            <div className="card-elevated p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-display font-semibold text-foreground">
                  Avaliações e Feedbacks
                </h2>
                <Link
                  to="/evaluation"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Ver todas
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              {evaluationCounts.isLoading && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <StatCardSkeleton key={i} />
                  ))}
                </div>
              )}
              {evaluationCounts.error && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-destructive">{evaluationCounts.error}</p>
                  <Button variant="outline" size="sm" onClick={evaluationCounts.refetch}>
                    Tentar novamente
                  </Button>
                </div>
              )}
              {!evaluationCounts.isLoading &&
                !evaluationCounts.error &&
                evaluationCounts.data && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      title="Recebidas"
                      value={evaluationCounts.data.received}
                      icon={<MessageSquare className="w-6 h-6" />}
                    />
                    <StatCard
                      title="Enviadas"
                      value={evaluationCounts.data.sent}
                      icon={<Send className="w-6 h-6" />}
                    />
                    <StatCard
                      title="Autoavaliações"
                      value={evaluationCounts.data.self}
                      icon={<UserCircle className="w-6 h-6" />}
                    />
                    <StatCard
                      title={isHR() ? 'Autoavaliações da empresa' : 'Autoavaliações da equipe'}
                      value={evaluationCounts.data.teamSelf}
                      icon={<Users className="w-6 h-6" />}
                    />
                  </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 card-elevated p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-display font-semibold text-foreground">
                    Atividade recente em PDIs
                  </h2>
                  <Link
                    to="/pdis"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Ver todos
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                {recentActivity.isLoading && <RecentActivitySkeleton />}
                {recentActivity.error && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-destructive">{recentActivity.error}</p>
                    <Button variant="outline" size="sm" onClick={recentActivity.refetch}>
                      Tentar novamente
                    </Button>
                  </div>
                )}
                {!recentActivity.isLoading && !recentActivity.error && (
                  <div className="space-y-4">
                    {!recentActivity.data || recentActivity.data.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma atividade recente.
                      </p>
                    ) : (
                      recentActivity.data.map((item: DashboardRecentActivityItem) => (
                        <Link
                          key={item.pdiId}
                          to={`/pdis/${item.pdiId}`}
                          className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors block"
                        >
                          <div className="w-12 h-12 rounded-full gradient-hero flex items-center justify-center text-white font-semibold shrink-0">
                            {getInitial(item.employeeName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">
                              {item.employeeName ?? 'PDI'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.title ?? 'PDI'} · Atualizado em{' '}
                              {formatActivityDate(item.updatedAt)}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </div>
              <MotivationalQuote />
            </div>
          </>
        ) : (
          /* Employee (Collaborator) Dashboard */
          <>
            {/* Avaliações e Feedbacks (Employee) — between totals and PDIs resume */}
            <div className="card-elevated p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-display font-semibold text-foreground">
                  Avaliações e Feedbacks
                </h2>
                <Link
                  to="/evaluation"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Ver todas
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              {evaluationCounts.isLoading && (
                <div className="grid grid-cols-3 gap-3">
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                </div>
              )}
              {evaluationCounts.error && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-destructive">{evaluationCounts.error}</p>
                  <Button variant="outline" size="sm" onClick={evaluationCounts.refetch}>
                    Tentar novamente
                  </Button>
                </div>
              )}
              {!evaluationCounts.isLoading &&
                !evaluationCounts.error &&
                evaluationCounts.data && (
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard
                      title="Recebidas"
                      value={evaluationCounts.data.received}
                      icon={<MessageSquare className="w-5 h-5" />}
                    />
                    <StatCard
                      title="Enviadas"
                      value={evaluationCounts.data.sent}
                      icon={<Send className="w-5 h-5" />}
                    />
                    <StatCard
                      title="Autoavaliações"
                      value={evaluationCounts.data.self}
                      icon={<UserCircle className="w-5 h-5" />}
                    />
                  </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 card-elevated p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-display font-semibold text-foreground">
                      Seu PDI
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Resumo dos seus planos de ação
                    </p>
                  </div>
                  {employeePdiSummary.data?.hasActivePdi &&
                    employeePdiSummary.data?.activePdiId && (
                      <Link
                        to={`/pdis/${employeePdiSummary.data.activePdiId}`}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        Ver PDI
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    )}
                </div>
                {employeePdiSummary.isLoading && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                  </div>
                )}
                {employeePdiSummary.error && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-destructive">{employeePdiSummary.error}</p>
                    <Button variant="outline" size="sm" onClick={employeePdiSummary.refetch}>
                      Tentar novamente
                    </Button>
                  </div>
                )}
                {!employeePdiSummary.isLoading &&
                  !employeePdiSummary.error &&
                  employeePdiSummary.data && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <StatCard
                        title="PDI ativo"
                        value={employeePdiSummary.data.hasActivePdi ? 'Sim' : 'Não'}
                        icon={<FileText className="w-6 h-6" />}
                      />
                      <StatCard
                        title="Total de planos de ação"
                        value={employeePdiSummary.data.totalActionPlans}
                        icon={<ClipboardCheck className="w-6 h-6" />}
                      />
                      <StatCard
                        title="Planos atrasados"
                        value={employeePdiSummary.data.overdueActionPlans}
                        icon={<Clock className="w-6 h-6" />}
                      />
                      <StatCard
                        title={`Próximos ${CLOSE_TO_DEADLINE_DAYS} dias`}
                        value={employeePdiSummary.data.closeToDeadlineActionPlans}
                        icon={<CalendarClock className="w-6 h-6" />}
                      />
                    </div>
                  )}
              </div>
              <div className="space-y-6">
                <MotivationalQuote />
                {!recentActivity.isLoading &&
                  !recentActivity.error &&
                  recentActivity.data &&
                  recentActivity.data.length > 0 && (
                    <div className="card-elevated p-6">
                      <h2 className="text-lg font-display font-semibold text-foreground mb-4">
                        Atualizações recentes
                      </h2>
                      <ul className="space-y-3">
                        {recentActivity.data.slice(0, 5).map((item: DashboardRecentActivityItem) => (
                          <li key={item.pdiId}>
                            <Link
                              to={`/pdis/${item.pdiId}`}
                              className="text-sm text-primary hover:underline"
                            >
                              {item.title ?? 'PDI'} · {formatActivityDate(item.updatedAt)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                to="/evaluation"
                className="card-interactive p-5 flex items-center gap-4 group"
              >
                <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                  <Star className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Minha Avaliação</h3>
                  <p className="text-sm text-muted-foreground">Ver histórico e feedback</p>
                </div>
                <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>

              {/* <Link
                to="/mentoring"
                className="card-interactive p-5 flex items-center gap-4 group"
              >
                <div className="p-3 rounded-xl bg-accent/10 text-accent group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Mentoria</h3>
                  <p className="text-sm text-muted-foreground">Sessão agendada: Seg 10h</p>
                </div>
                <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
              </Link> */}

              <Link
                to="/assessment"
                className="card-interactive p-5 flex items-center gap-4 group"
              >
                <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Perfil DISC</h3>
                  <p className="text-sm text-muted-foreground">Descubra seu perfil</p>
                </div>
                <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
