import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import {
  applyBrandingToCss,
  saveBrandingCache,
  isHexColor,
  hslToHex,
  DEFAULT_PRIMARY_HEX,
  DEFAULT_ACCENT_HEX,
  type BrandingConfig,
} from '@/lib/branding';

export interface BrandConfig {
  companyName: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  loginCoverUrl?: string;
}

interface BrandContextType {
  brand: BrandConfig;
  updateBrand: (config: Partial<BrandConfig>) => void;
}

const defaultBrand: BrandConfig = {
  companyName: 'Facholi',
  logoUrl: '/assets/facholi-logo.png',
  primaryColor: DEFAULT_PRIMARY_HEX,
  accentColor: DEFAULT_ACCENT_HEX,
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

function tenantPrimaryToHex(value: string): string {
  if (isHexColor(value)) {
    const normalized = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
    return normalized.length === 4 ? normalized : normalized;
  }
  return hslToHex(value);
}

function tenantAccentToHex(value: string): string {
  if (isHexColor(value)) {
    const normalized = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
    return normalized;
  }
  return hslToHex(value);
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const { tenant } = useTenant();
  const [brand, setBrand] = useState<BrandConfig>(defaultBrand);

  useEffect(() => {
    if (tenant) {
      const primaryHex = tenantPrimaryToHex(tenant.primaryColor);
      const accentHex = tenantAccentToHex(tenant.accentColor);
      const newBrand: BrandConfig = {
        companyName: tenant.companyName,
        logoUrl: tenant.logoUrl ?? undefined,
        primaryColor: primaryHex,
        accentColor: accentHex,
        loginCoverUrl: tenant.loginCoverUrl ?? undefined,
      };
      setBrand(newBrand);
      applyBrandingToCss({
        primaryColor: primaryHex,
        accentColor: accentHex,
        logoUrl: newBrand.logoUrl,
        loginCoverUrl: newBrand.loginCoverUrl,
        companyName: newBrand.companyName,
      });
      saveBrandingCache({
        primaryColor: primaryHex,
        accentColor: accentHex,
        logoUrl: newBrand.logoUrl,
        loginCoverUrl: newBrand.loginCoverUrl,
        companyName: newBrand.companyName,
      });
    }
  }, [tenant]);

  const updateBrand = (config: Partial<BrandConfig>) => {
    setBrand((prev) => {
      const next = { ...prev, ...config };
      applyBrandingToCss({
        primaryColor: next.primaryColor,
        accentColor: next.accentColor,
        logoUrl: next.logoUrl,
        loginCoverUrl: next.loginCoverUrl,
        companyName: next.companyName,
      });
      if (next.primaryColor || next.accentColor || next.logoUrl !== undefined || next.loginCoverUrl !== undefined || next.companyName !== undefined) {
        saveBrandingCache({
          primaryColor: next.primaryColor ?? DEFAULT_PRIMARY_HEX,
          accentColor: next.accentColor ?? DEFAULT_ACCENT_HEX,
          logoUrl: next.logoUrl,
          loginCoverUrl: next.loginCoverUrl,
          companyName: next.companyName,
        });
      }
      return next;
    });
  };

  return (
    <BrandContext.Provider value={{ brand, updateBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}
