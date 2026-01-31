import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/ui/stat-card';
import { MotivationalQuote } from '@/components/dashboard/MotivationalQuote';
import { ProgressSteps } from '@/components/ui/progress-steps';
import { 
  ClipboardCheck, 
  Users, 
  TrendingUp, 
  Calendar,
  ChevronRight,
  Star
} from 'lucide-react';
import { Link } from 'react-router-dom';

const onboardingSteps = [
  { id: '1', title: 'Documentação inicial', completed: true },
  { id: '2', title: 'Treinamento institucional', completed: true },
  { id: '3', title: 'Conhecer a equipe', completed: false, current: true },
  { id: '4', title: 'Primeiro projeto', completed: false },
];

const hrStats = [
  { title: 'Colaboradores Ativos', value: 127, icon: <Users className="w-6 h-6" />, trend: { value: 12, positive: true } },
  { title: 'Em Onboarding', value: 8, icon: <ClipboardCheck className="w-6 h-6" /> },
  { title: 'Avaliações Pendentes', value: 23, icon: <Calendar className="w-6 h-6" /> },
  { title: 'Taxa de Engajamento', value: '94%', icon: <TrendingUp className="w-6 h-6" />, trend: { value: 5, positive: true } },
];

const recentEmployees = [
  { id: 1, name: 'Ana Costa', role: 'Designer UX', progress: 75, avatar: 'A' },
  { id: 2, name: 'Carlos Lima', role: 'Desenvolvedor', progress: 50, avatar: 'C' },
  { id: 3, name: 'Julia Martins', role: 'Analista de Dados', progress: 25, avatar: 'J' },
];

export default function Dashboard() {
  const { user, canManageUsers, isHR } = useAuth();
  const showTeamView = canManageUsers();

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
          // HR Dashboard
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {hrStats.map((stat, index) => (
                <StatCard
                  key={stat.title}
                  {...stat}
                  variant={index === 0 ? 'primary' : 'default'}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Onboarding */}
              <div className="lg:col-span-2 card-elevated p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-display font-semibold text-foreground">
                    Onboarding Recente
                  </h2>
                  <Link 
                    to="/onboarding"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Ver todos
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="space-y-4">
                  {recentEmployees.map((employee) => (
                    <div 
                      key={employee.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full gradient-hero flex items-center justify-center text-white font-semibold">
                        {employee.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{employee.name}</p>
                        <p className="text-sm text-muted-foreground">{employee.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-primary">{employee.progress}%</p>
                        <div className="w-20 h-2 bg-muted rounded-full mt-1 overflow-hidden">
                          <div 
                            className="h-full gradient-hero rounded-full transition-all duration-500"
                            style={{ width: `${employee.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Motivational Quote */}
              <MotivationalQuote />
            </div>
          </>
        ) : (
          // Employee Dashboard
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Onboarding Progress */}
              <div className="lg:col-span-2 card-elevated p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-display font-semibold text-foreground">
                      Seu Onboarding
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Continue de onde parou
                    </p>
                  </div>
                  <Link 
                    to="/onboarding"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Ver detalhes
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <ProgressSteps steps={onboardingSteps} />
              </div>

              {/* Quick Stats */}
              <div className="space-y-6">
                <StatCard
                  title="Próxima Avaliação"
                  value="15 dias"
                  subtitle="Avaliação trimestral"
                  icon={<Calendar className="w-6 h-6" />}
                />
                <MotivationalQuote />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link to="/evaluation" className="card-interactive p-5 flex items-center gap-4 group">
                <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                  <Star className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Minha Avaliação</h3>
                  <p className="text-sm text-muted-foreground">Ver histórico e feedback</p>
                </div>
                <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>

              <Link to="/mentoring" className="card-interactive p-5 flex items-center gap-4 group">
                <div className="p-3 rounded-xl bg-accent/10 text-accent group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Mentoria</h3>
                  <p className="text-sm text-muted-foreground">Sessão agendada: Seg 10h</p>
                </div>
                <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>

              <Link to="/assessment" className="card-interactive p-5 flex items-center gap-4 group">
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
