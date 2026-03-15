import { Outlet, Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';

export function BackofficeLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-4">
          <Link
            to="/backoffice/tenants"
            className="flex items-center gap-2 text-lg font-medium text-foreground hover:text-primary"
          >
            <Building2 className="h-5 w-5" />
            Backoffice
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              to="/backoffice/tenants"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Tenants
            </Link>
            <Link
              to="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Voltar ao app
            </Link>
          </nav>
        </div>
      </header>
      <main className="p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
