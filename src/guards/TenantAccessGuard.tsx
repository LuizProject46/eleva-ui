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
export function TenantAccessGuard({ children }: TenantAccessGuardProps) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.isPlatformAdmin === true) {
    return <>{children}</>;
  }

  const isTenantUser = user.tenantId != null;
  const tenantMatches = tenant?.id != null && user.tenantId === tenant.id;

  if (isTenantUser && !tenantMatches) {
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
