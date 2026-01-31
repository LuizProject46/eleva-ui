import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users,
  Calendar,
  Target,
  MessageCircle,
  Video,
  Clock,
  CheckCircle2,
  Plus
} from 'lucide-react';

interface MentoringSession {
  id: string;
  date: string;
  time: string;
  topic: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  goals?: string[];
}

interface Mentor {
  id: string;
  name: string;
  role: string;
  avatar: string;
  expertise: string[];
}

const mockMentor: Mentor = {
  id: '1',
  name: 'Roberto Mendes',
  role: 'Tech Lead',
  avatar: 'R',
  expertise: ['Liderança', 'Arquitetura de Software', 'Gestão de Equipes'],
};

const mockSessions: MentoringSession[] = [
  {
    id: '1',
    date: '2025-02-03',
    time: '10:00',
    topic: 'Planejamento de Carreira',
    status: 'scheduled',
    goals: ['Definir objetivos para 2025', 'Identificar áreas de desenvolvimento'],
  },
  {
    id: '2',
    date: '2025-01-20',
    time: '10:00',
    topic: 'Feedback sobre Projeto X',
    status: 'completed',
    notes: 'Discussão sobre os aprendizados do projeto e próximos passos de desenvolvimento.',
    goals: ['Revisar entregas do trimestre', 'Planejar próximas capacitações'],
  },
  {
    id: '3',
    date: '2025-01-06',
    time: '10:00',
    topic: 'Desenvolvimento de Soft Skills',
    status: 'completed',
    notes: 'Foco em comunicação assertiva e apresentações.',
    goals: ['Melhorar comunicação em reuniões', 'Praticar apresentações'],
  },
];

const developmentGoals = [
  { id: '1', title: 'Melhorar comunicação em reuniões', progress: 70, completed: false },
  { id: '2', title: 'Aprender TypeScript avançado', progress: 45, completed: false },
  { id: '3', title: 'Liderar um projeto pequeno', progress: 100, completed: true },
  { id: '4', title: 'Mentoria de novo colaborador', progress: 20, completed: false },
];

export default function Mentoring() {
  const { user } = useAuth();
  const isHR = user?.role === 'hr';
  const [sessions] = useState(mockSessions);
  const [selectedSession, setSelectedSession] = useState<MentoringSession | null>(sessions[0]);
  const [showNewSession, setShowNewSession] = useState(false);
  const [newNote, setNewNote] = useState('');

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {isHR ? 'Programa de Mentoria' : 'Minha Mentoria'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isHR 
                ? 'Gerencie as relações de mentoria do time'
                : 'Acompanhe seu desenvolvimento profissional'}
            </p>
          </div>
          <Button className="gradient-hero" onClick={() => setShowNewSession(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Agendar Sessão
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Mentor Card */}
            <div className="card-elevated p-6">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
                {isHR ? 'Mentores Ativos' : 'Seu Mentor'}
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full gradient-hero flex items-center justify-center text-white text-xl font-bold">
                  {mockMentor.avatar}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{mockMentor.name}</p>
                  <p className="text-sm text-muted-foreground">{mockMentor.role}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {mockMentor.expertise.map((skill) => (
                  <span 
                    key={skill}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary"
                  >
                    {skill}
                  </span>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4">
                <MessageCircle className="w-4 h-4 mr-2" />
                Enviar Mensagem
              </Button>
            </div>

            {/* Development Goals */}
            <div className="card-elevated p-6">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
                Metas de Desenvolvimento
              </h3>
              <div className="space-y-4">
                {developmentGoals.map((goal) => (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${goal.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {goal.title}
                      </span>
                      {goal.completed && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    {!goal.completed && (
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full gradient-hero rounded-full transition-all duration-500"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="w-full mt-4 text-primary">
                <Target className="w-4 h-4 mr-2" />
                Adicionar Nova Meta
              </Button>
            </div>
          </div>

          {/* Center - Sessions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upcoming Session */}
            {sessions.find(s => s.status === 'scheduled') && (
              <div className="card-elevated p-6 border-l-4 border-l-accent">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-medium text-accent uppercase tracking-wide">
                      Próxima Sessão
                    </span>
                    <h3 className="text-lg font-display font-semibold text-foreground mt-1">
                      {sessions.find(s => s.status === 'scheduled')?.topic}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(sessions.find(s => s.status === 'scheduled')?.date || '').toLocaleDateString('pt-BR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {sessions.find(s => s.status === 'scheduled')?.time}
                      </span>
                    </div>
                  </div>
                  <Button className="gradient-accent">
                    <Video className="w-4 h-4 mr-2" />
                    Entrar
                  </Button>
                </div>
                
                {sessions.find(s => s.status === 'scheduled')?.goals && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm font-medium text-foreground mb-2">Objetivos da sessão:</p>
                    <ul className="space-y-1">
                      {sessions.find(s => s.status === 'scheduled')?.goals?.map((goal, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                          {goal}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Session History */}
            <div className="card-elevated p-6">
              <h3 className="font-display font-semibold text-foreground mb-4">
                Histórico de Sessões
              </h3>
              <div className="space-y-4">
                {sessions.filter(s => s.status === 'completed').map((session) => (
                  <div 
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                      selectedSession?.id === session.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-foreground">{session.topic}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{new Date(session.date).toLocaleDateString('pt-BR')}</span>
                          <span>•</span>
                          <span>{session.time}</span>
                        </div>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                        Concluída
                      </span>
                    </div>
                    {session.notes && (
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                        {session.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add Notes */}
            {selectedSession?.status === 'completed' && (
              <div className="card-elevated p-6">
                <h3 className="font-display font-semibold text-foreground mb-4">
                  Adicionar Anotações
                </h3>
                <Textarea 
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Registre insights, ações e próximos passos..."
                  className="min-h-[100px]"
                />
                <div className="flex justify-end mt-4">
                  <Button className="gradient-hero">
                    Salvar Anotação
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
