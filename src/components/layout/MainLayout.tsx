import { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { Button } from '@/components/ui/button';
import { MobileMenuProvider, useMobileMenu } from '@/contexts/MobileMenuContext';

interface MainLayoutProps {
  children: ReactNode;
}

function MainLayoutInner({ children }: MainLayoutProps) {
  const { isMobile, setMobileMenuOpen } = useMobileMenu();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-0 md:ml-64 min-h-screen">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 md:px-8 py-4 bg-background/95 backdrop-blur border-b border-border">
          {isMobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          ) : (
            <div />
          )}
          <NotificationBell />
        </header>
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <MobileMenuProvider>
      <MainLayoutInner>{children}</MainLayoutInner>
    </MobileMenuProvider>
  );
}
