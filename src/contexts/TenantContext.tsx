import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export interface TenantConfig {
  id: string;
  slug: string;
  companyName: string;
  logoUrl?: string | null;
  loginCoverUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  isActive: boolean;
}

interface TenantContextType {
  tenant: TenantConfig | null;
  slug: string | null;
  isLoading: boolean;
  error: string | null;
  refetchTenant: () => Promise<void>;
}

const DEFAULT_SLUG = 'eleva-ui-vercel';

function getTenantSlugFromHost(): string {
  if (typeof window === 'undefined') return DEFAULT_SLUG;

  const params = new URLSearchParams(window.location.search);
  const queryTenant = params.get('tenant');
  if (queryTenant) return queryTenant;

  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return DEFAULT_SLUG;
  }

  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts[0];
  }

  return DEFAULT_SLUG;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const defaultTenantConfig: TenantConfig = {
  id: '',
  slug: DEFAULT_SLUG,
  companyName: 'Facholi',
  logoUrl: '/assets/facholi-logo.png',
  primaryColor: '145 75% 38%',
  accentColor: '24 95% 60%',
  isActive: true,
};

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenant = useCallback(async (tenantSlug: string): Promise<TenantConfig | null> => {
    const { data, error: fetchError } = await supabase
      .from('tenants')
      .select('id, slug, company_name, logo_url, login_cover_url, primary_color, accent_color, is_active')
      .eq('slug', tenantSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError || !data) return null;

    return {
      id: data.id,
      slug: data.slug,
      companyName: data.company_name,
      logoUrl: data.logo_url,
      loginCoverUrl: data.login_cover_url ?? undefined,
      primaryColor: data.primary_color ?? defaultTenantConfig.primaryColor,
      accentColor: data.accent_color ?? defaultTenantConfig.accentColor,
      isActive: data.is_active ?? true,
    };
  }, []);

  const loadTenant = useCallback(async () => {
    const tenantSlug = getTenantSlugFromHost();
    setSlug(tenantSlug);
    try {
      const config = await fetchTenant(tenantSlug);
      if (config) {
        setTenant(config);
        setError(null);
      } else {
        setTenant({
          ...defaultTenantConfig,
          slug: tenantSlug,
          companyName: tenantSlug.charAt(0).toUpperCase() + tenantSlug.slice(1),
        });
        setError(null);
      }
    } catch (err) {
      setTenant({ ...defaultTenantConfig, slug: tenantSlug });
      setError('Falha ao carregar configuração do tenant.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchTenant]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  const refetchTenant = useCallback(async () => {
    setIsLoading(true);
    await loadTenant();
  }, [loadTenant]);

  return (
    <TenantContext.Provider value={{ tenant, slug, isLoading, error, refetchTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
