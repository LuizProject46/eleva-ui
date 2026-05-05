import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  UserCheck,
  Brain,
  LogOut,
  Settings,
  ChevronRight,
  ChevronDown,
  Award,
  ClipboardList,
  Gamepad2,
  Lock,
  GraduationCap,
  Building2,
  Grid3x3,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useMobileMenu } from '@/contexts/MobileMenuContext';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';

interface NavLeafItem {
  kind: 'leaf';
  icon: LucideIcon;
  label: string;
  path: string;
}

interface NavEvaluationsGroup {
  kind: 'evaluations';
  icon: LucideIcon;
  sectionLabel: string;
}

type SidebarNavItem = NavLeafItem | NavEvaluationsGroup;

const employeeNavItems: SidebarNavItem[] = [
  { kind: 'leaf', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { kind: 'leaf', icon: GraduationCap, label: 'Meus Cursos', path: '/courses' },
  { kind: 'leaf', icon: Award, label: 'Certificados', path: '/certificates' },
  { kind: 'evaluations', icon: UserCheck, sectionLabel: 'Avaliações' },
  { kind: 'leaf', icon: Brain, label: 'Teste Comportamental', path: '/assessment' },
  { kind: 'leaf', icon: ClipboardList, label: 'PDI', path: '/pdis' },
];

const managerNavItems: SidebarNavItem[] = [
  { kind: 'leaf', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { kind: 'leaf', icon: GraduationCap, label: 'Cursos / Treinamentos', path: '/courses' },
  { kind: 'leaf', icon: Award, label: 'Certificados', path: '/certificates' },
  { kind: 'evaluations', icon: UserCheck, sectionLabel: 'Avaliações' },
  { kind: 'leaf', icon: Brain, label: 'Teste Comportamental', path: '/assessment' },
  { kind: 'leaf', icon: ClipboardList, label: 'PDI', path: '/pdis' },
  { kind: 'leaf', icon: Grid3x3, label: 'Matriz 9Box', path: '/nine-box' },
  { kind: 'leaf', icon: UserPlus, label: 'Minha Equipe', path: '/employees' },
];

const hrNavItems: SidebarNavItem[] = [
  { kind: 'leaf', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { kind: 'leaf', icon: GraduationCap, label: 'Cursos / Treinamentos', path: '/courses' },
  { kind: 'evaluations', icon: UserCheck, sectionLabel: 'Avaliações' },
  { kind: 'leaf', icon: Brain, label: 'Teste Comportamental', path: '/assessment' },
  { kind: 'leaf', icon: ClipboardList, label: 'PDI', path: '/pdis' },
  { kind: 'leaf', icon: Grid3x3, label: 'Matriz 9Box', path: '/nine-box' },
  { kind: 'leaf', icon: UserPlus, label: 'Colaboradores', path: '/employees' },
];

const comingSoonConfig = {
  mentoria: { enabled: false, path: '/mentoring' },
  pesquisaClima: { enabled: false, path: '/pesquisa-clima' },
  gamificacao: { enabled: false, path: '/gamificacao' },
} as const;

const comingSoonNavItems = [
  { id: 'pesquisaClima' as const, icon: ClipboardList, label: 'Pesquisa de Clima' },
  { id: 'gamificacao' as const, icon: Gamepad2, label: 'Gamificação' },
  { id: 'mentoria' as const, icon: Users, label: 'Mentoria' },
];

function getNavItems(role: string): SidebarNavItem[] {
  if (role === 'hr') return hrNavItems;
  if (role === 'manager') return managerNavItems;
  return employeeNavItems;
}

const EVALUATION_SUBLINKS = [
  { label: 'Feedback', path: '/evaluation' },
  { label: 'Objetivos', path: '/evaluation/objectives' },
  { label: 'Competências', path: '/evaluation/competencies' },
] as const;

function isEvaluationsPath(pathname: string): boolean {
  return pathname === '/evaluation' || pathname.startsWith('/evaluation/');
}

function EvaluationsNavGroup({ icon: Icon, sectionLabel }: { icon: LucideIcon; sectionLabel: string }) {
  const location = useLocation();
  const inSection = isEvaluationsPath(location.pathname);
  const [isOpen, setIsOpen] = useState(inSection);

  useEffect(() => {
    if (inSection) setIsOpen(true);
  }, [inSection]);

  const isChildActive = (path: string) =>
    path === '/evaluation'
      ? location.pathname === '/evaluation' || location.pathname === '/evaluation/'
      : location.pathname === path || location.pathname.startsWith(`${path}/`);

  const isParentActive = EVALUATION_SUBLINKS.some((s) => isChildActive(s.path));

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-1">
      <CollapsibleTrigger
        type="button"
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-left',
          isParentActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
        )}
        aria-expanded={isOpen}
      >
        <Icon
          className={cn(
            'w-5 h-5 shrink-0 transition-transform duration-200',
            isParentActive ? '' : 'group-hover:scale-110'
          )}
        />
        <span className="font-medium text-sm flex-1 min-w-0">{sectionLabel}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 transition-transform duration-200',
            isOpen ? 'rotate-180' : '',
            isParentActive ? 'text-sidebar-primary-foreground' : ''
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pl-3 pb-1">
        {EVALUATION_SUBLINKS.map((sub) => {
          const active = isChildActive(sub.path);
          return (
            <Link
              key={sub.path}
              to={sub.path}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
              )}
            >
              <span className="w-3.5 shrink-0 flex justify-center" aria-hidden>
                {active ? <ChevronRight className="w-3.5 h-3.5" /> : null}
              </span>
              <span>{sub.label}</span>
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function getRoleLabel(role: string) {
  if (role === 'hr') return 'RH';
  if (role === 'manager') return 'Gestor';
  return 'Colaborador';
}

function SidebarContent() {
  const { user, logout, isPlatformAdmin } = useAuth();
  const { brand } = useBrand();
  const location = useLocation();

  const navItems = getNavItems(user?.role ?? 'employee');
  const roleLabel = getRoleLabel(user?.role ?? 'employee');

  return (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3 justify-center">
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt={brand.companyName}
              className="h-20 w-auto object-contain rounded-2xl"
              loading='lazy'
            />
          ) : (
            <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {brand.companyName.charAt(0)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 mx-3 mt-4 rounded-xl bg-sidebar-accent/50">
        <div className="flex items-center gap-3">
          {user?.avatar ? (
            <UserAvatar
              avatarUrl={user?.avatar}
              avatarThumbUrl={user?.avatarThumbUrl}
              name={user?.name ?? ''}
              size="md"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
              <span className="text-sidebar-primary font-semibold">
                {user?.name.toUpperCase().charAt(0)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.name}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {user?.isPlatformAdmin ? 'Administrador' : roleLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-scrollbar flex-1 p-3 pr-2 mt-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (item.kind === 'evaluations') {
            return (
              <EvaluationsNavGroup
                key="evaluations"
                icon={item.icon}
                sectionLabel={item.sectionLabel}
              />
            );
          }
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <item.icon
                className={cn(
                  'w-5 h-5 transition-transform duration-200',
                  isActive ? '' : 'group-hover:scale-110'
                )}
              />
              <span className="font-medium text-sm">{item.label}</span>
              {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
            </Link>
          );
        })}

        {/* Itens em breve */}
        <div className="mt-4 pt-3 border-t border-sidebar-border/50 space-y-1">
          {comingSoonNavItems
            .filter((item) => !comingSoonConfig[item.id].enabled)
            .map((item) => {
              const Icon = item.icon;
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <div
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground/50 opacity-60 cursor-not-allowed"
                      aria-disabled
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="font-medium text-sm flex-1">{item.label}</span>
                      <Lock className="w-4 h-4 ml-auto opacity-70 shrink-0" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Em breve
                  </TooltipContent>
                </Tooltip>
              );
            })}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {isPlatformAdmin() && (
          <Link
            to="/backoffice/tenants"
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
              location.pathname.startsWith('/backoffice')
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <Building2 className="w-5 h-5" />
            <span className="font-medium text-sm">Backoffice</span>
            {location.pathname.startsWith('/backoffice') && <ChevronRight className="w-4 h-4 ml-auto" />}
          </Link>
        )}
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
    </>
  );
}

export function Sidebar() {
  const { isMobile, mobileMenuOpen, setMobileMenuOpen } = useMobileMenu();
  const location = useLocation();

  useEffect(() => {
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  }, [isMobile, location.pathname, setMobileMenuOpen]);

  if (isMobile) {
    return (
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-64 max-w-[85vw] h-full p-0 gap-0 border-r border-sidebar-border rounded-r-lg flex flex-col sidebar-gradient"
        >
          <div className="flex flex-col flex-1 h-full min-h-0">
            <SidebarContent />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 sidebar-gradient border-r border-sidebar-border flex flex-col">
      <SidebarContent />
    </aside>
  );
}
