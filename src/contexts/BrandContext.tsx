import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BrandConfig {
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

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig>(defaultBrand);

  const updateBrand = (config: Partial<BrandConfig>) => {
    setBrand(prev => ({ ...prev, ...config }));
    
    // Update CSS variables for whitelabel
    if (config.primaryColor) {
      document.documentElement.style.setProperty('--brand-primary', config.primaryColor);
      document.documentElement.style.setProperty('--primary', config.primaryColor);
    }
    if (config.accentColor) {
      document.documentElement.style.setProperty('--brand-accent', config.accentColor);
      document.documentElement.style.setProperty('--accent', config.accentColor);
    }
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
