import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

interface TenantAccessGuardProps {
  children: ReactNode;
}

/**
 * Enforces tenant isolation for authenticated users.
 * - Platform users (isPlatformAdmin): allowed regardless of current tenant slug.
 * - Tenant users: allowed only when current URL tenant matches their tenant_id.
 * Use inside ProtectedRoute so it runs only after auth is confirmed.
 */
function TenantGuardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function TenantAccessGuard({ children }: TenantAccessGuardProps) {
  const { user } = useAuth();
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.isPlatformAdmin === true) {
    return <>{children}</>;
  }

  if (isTenantLoading) {
    return <TenantGuardLoading />;
  }

  const isTenantUser = user.tenantId != null;
  /** Real row from DB; fallback placeholder uses id '' (e.g. local dev) — must not treat as mismatch or /login ↔ /dashboard loops. */
  const tenantResolved = Boolean(tenant?.id);
  const tenantMatches = tenantResolved && user.tenantId === tenant.id;

  if (isTenantUser && tenantResolved && !tenantMatches) {
    return (
      <Navigate
        to={{ pathname: '/login', search: '?reason=wrong_tenant' }}
        replace
        state={{ from: location }}
      />
    );
  }

  return <>{children}</>;
}
