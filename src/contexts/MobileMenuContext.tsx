import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileMenuContextValue {
  isMobile: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const MobileMenuContext = createContext<MobileMenuContextValue | null>(null);

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const setOpen = useCallback((open: boolean) => {
    setMobileMenuOpen(open);
  }, []);

  return (
    <MobileMenuContext.Provider
      value={{
        isMobile,
        mobileMenuOpen,
        setMobileMenuOpen: setOpen,
      }}
    >
      {children}
    </MobileMenuContext.Provider>
  );
}

export function useMobileMenu() {
  const ctx = useContext(MobileMenuContext);
  if (!ctx) {
    throw new Error('useMobileMenu must be used within MobileMenuProvider');
  }
  return ctx;
}
