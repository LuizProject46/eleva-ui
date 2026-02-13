import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { useTenant } from '@/contexts/TenantContext';

export type UserRole = 'employee' | 'manager' | 'hr';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  avatarThumbUrl?: string;
  department?: string;
  position?: string;
  tenantId?: string;
}

/** Minimal profile shape for permission checks (e.g. manager_id for canEditUser) */
export interface TargetProfileForPermission {
  id?: string;
  manager_id?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isHR: () => boolean;
  isManager: () => boolean;
  canManageUsers: () => boolean;
  canCreateUser: () => boolean;
  canEditUser: (targetProfile: TargetProfileForPermission) => boolean;
  canChangeRoleAndStatus: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapProfileToUser(profile: {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string | null;
  position?: string | null;
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
  tenant_id?: string | null;
}): User {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as UserRole,
    department: profile.department ?? undefined,
    position: profile.position ?? undefined,
    avatar: profile.avatar_url ?? undefined,
    avatarThumbUrl: profile.avatar_thumb_url ?? undefined,
    tenantId: profile.tenant_id ?? undefined,
  };
}

async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, department, position, avatar_url, avatar_thumb_url, tenant_id, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    const { data: fallback } = await supabase
      .from('profiles')
      .select('id, email, name, role, department, position, avatar_url, avatar_thumb_url, is_active')
      .eq('id', userId)
      .maybeSingle();
    if (fallback) {
      if (fallback.is_active === false) return null;
      return mapProfileToUser(fallback);
    }
    return null;
  }
  if (!data) return null;
  if (data.is_active === false) return null;
  return mapProfileToUser(data);
}

const INIT_SESSION_TIMEOUT_MS = 10_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const { tenant } = useTenant();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const ensureProfileTenant = useCallback(
    async (userId: string): Promise<void> => {
      if (!tenant?.id) return;
      await supabase
        .from('profiles')
        .update({ tenant_id: tenant.id })
        .eq('id', userId)
        .is('tenant_id', null);
    },
    [tenant?.id]
  );

  const loadUser = useCallback(
    async (supabaseUser: SupabaseUser): Promise<User | null> => {
      const profile = await fetchProfile(supabaseUser.id);
      if (!profile) return null;

      if (tenant && profile.tenantId && profile.tenantId !== tenant.id) {
        return null;
      }

      if (tenant && !profile.tenantId) {
        await ensureProfileTenant(supabaseUser.id);
        const updated = await fetchProfile(supabaseUser.id);
        if (updated) {
          setUser(updated);
          return updated;
        }
      }

      setUser(profile);
      return profile;
    },
    [tenant, ensureProfileTenant]
  );

  const clearSession = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initSession = async () => {
      const timeoutId = setTimeout(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      }, INIT_SESSION_TIMEOUT_MS);

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          const profile = await loadUser(session.user);
          if (!profile && !cancelled) {
            await clearSession();
          }
        } else {
          setUser(null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setIsLoading(false);
        }
      }
    };

    initSession();

    // const { data: { subscription } } = supabase.auth.onAuthStateChange(
    //   async (event: AuthChangeEvent, session) => {
    //     if (event === 'INITIAL_SESSION') return;

    //     if (cancelled) return;

    //     if (event === 'PASSWORD_RECOVERY' && session?.user) {
    //       const profile = await loadUser(session.user);
    //       if (profile) setUser(profile);
    //       return;
    //     }

    //     if (event === 'SIGNED_OUT' || !session) {
    //       setUser(null);
    //       return;
    //     }

    //     if (session.user) {
    //       const profile = await loadUser(session.user);
    //       if (!profile) {
    //         await clearSession();
    //       }
    //     }
    //   }
    // );

    // return () => {
    //   cancelled = true;
    //   subscription.unsubscribe();
    // };
  }, [loadUser, clearSession]);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      let profile = await loadUser(data.user);
      if (!profile) {
        await clearSession();
        const { data: check } = await supabase
          .from('profiles')
          .select('is_active')
          .eq('id', data.user.id)
          .maybeSingle();
        if (check?.is_active === false) {
          throw new Error('Sua conta está inativa. Entre em contato com o RH.');
        }
        throw new Error('Perfil não encontrado ou acesso não permitido para este portal. Entre em contato com o suporte.');
      }
      if (tenant && !profile.tenantId) {
        await ensureProfileTenant(data.user.id);
        profile = await fetchProfile(data.user.id);
        if (profile) setUser(profile);
      }
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      if (profile) setUser(profile);
    }
  }, []);

  const isHR = () => user?.role === 'hr';
  const isManager = () => user?.role === 'manager';
  const canManageUsers = () => user?.role === 'hr' || user?.role === 'manager';
  const canCreateUser = () => user?.role === 'hr';
  const canEditUser = (targetProfile: TargetProfileForPermission) => {
    if (!user) return false;
    if (user.role === 'hr') return true;
    if (user.role === 'manager') return targetProfile.manager_id === user.id;
    return false;
  };
  const canChangeRoleAndStatus = () => user?.role === 'hr';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
        isHR,
        isManager,
        canManageUsers,
        canCreateUser,
        canEditUser,
        canChangeRoleAndStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
