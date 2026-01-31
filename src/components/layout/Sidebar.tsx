import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  ClipboardCheck, 
  UserCheck, 
  Brain,
  LogOut,
  Settings,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { cn } from '@/lib/utils';
import facholiLogo from '@/assets/facholi-logo.png';

const employeeNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: ClipboardCheck, label: 'Meu Onboarding', path: '/onboarding' },
  { icon: UserCheck, label: 'Avaliação', path: '/evaluation' },
  { icon: Users, label: 'Mentoria', path: '/mentoring' },
  { icon: Brain, label: 'Teste Comportamental', path: '/assessment' },
];

const managerNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: ClipboardCheck, label: 'Onboarding da Equipe', path: '/onboarding' },
  { icon: UserCheck, label: 'Avaliações', path: '/evaluation' },
  { icon: Users, label: 'Mentorias', path: '/mentoring' },
  { icon: Brain, label: 'Perfis DISC', path: '/assessment' },
];

const hrNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: ClipboardCheck, label: 'Onboarding', path: '/onboarding' },
  { icon: UserCheck, label: 'Avaliações', path: '/evaluation' },
  { icon: Users, label: 'Mentorias', path: '/mentoring' },
  { icon: Brain, label: 'Perfis DISC', path: '/assessment' },
];

function getNavItems(role: string) {
  if (role === 'hr') return hrNavItems;
  if (role === 'manager') return managerNavItems;
  return employeeNavItems;
}

function getRoleLabel(role: string) {
  if (role === 'hr') return 'RH';
  if (role === 'manager') return 'Gestor';
  return 'Colaborador';
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const { brand } = useBrand();
  const location = useLocation();
  
  const navItems = getNavItems(user?.role ?? 'employee');
  const roleLabel = getRoleLabel(user?.role ?? 'employee');

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 sidebar-gradient border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          {brand.logoUrl ? (
            <img 
              src={facholiLogo} 
              alt={brand.companyName}
              className="h-10 w-auto object-contain"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {brand.companyName.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <p className="text-xs text-sidebar-foreground/60">
              Portal RH
            </p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 mx-3 mt-4 rounded-xl bg-sidebar-accent/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
            <span className="text-sidebar-primary font-semibold">
              {user?.name.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.name}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {roleLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 mt-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform duration-200",
                isActive ? "" : "group-hover:scale-110"
              )} />
              <span className="font-medium text-sm">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 ml-auto" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Link
          to="/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium text-sm">Configurações</span>
        </Link>
        <button
          onClick={() => void logout()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Sair</span>
        </button>
      </div>
    </aside>
  );
}
