import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <header className="sticky top-0 z-10 flex items-center justify-end gap-2 px-8 py-4 bg-background/95 backdrop-blur border-b border-border">
          <NotificationBell />
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
