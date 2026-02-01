import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTenant } from '@/contexts/TenantContext';

export interface BrandConfig {
  companyName: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
}

interface BrandContextType {
  brand: BrandConfig;
  updateBrand: (config: Partial<BrandConfig>) => void;
}

const defaultBrand: BrandConfig = {
  companyName: 'Facholi',
  logoUrl: '/assets/facholi-logo.png',
  primaryColor: '145 75% 38%',
  accentColor: '24 95% 60%',
};

const BrandContext = createContext<BrandContextType | undefined>(undefined);

function applyBrandToCss(config: Partial<BrandConfig>) {
  if (config.primaryColor) {
    document.documentElement.style.setProperty('--brand-primary', config.primaryColor);
    document.documentElement.style.setProperty('--primary', config.primaryColor);
  }
  if (config.accentColor) {
    document.documentElement.style.setProperty('--brand-accent', config.accentColor);
    document.documentElement.style.setProperty('--accent', config.accentColor);
  }
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const { tenant } = useTenant();
  const [brand, setBrand] = useState<BrandConfig>(defaultBrand);

  useEffect(() => {
    if (tenant) {
      const newBrand: BrandConfig = {
        companyName: tenant.companyName,
        logoUrl: tenant.logoUrl ?? undefined,
        primaryColor: tenant.primaryColor,
        accentColor: tenant.accentColor,
      };
      setBrand(newBrand);
      applyBrandToCss(newBrand);
    }
  }, [tenant]);

  const updateBrand = (config: Partial<BrandConfig>) => {
    setBrand(prev => {
      const next = { ...prev, ...config };
      applyBrandToCss(config);
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
