import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';

export type UserRole = 'employee' | 'manager' | 'hr';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  position?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isHR: () => boolean;
  isManager: () => boolean;
  canManageUsers: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verificação de sessão ao carregar a aplicação
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const response = await api.get('/api/me');
      setUser(response.data);
    } catch (error) {
      // Se não houver sessão válida (401), apenas define user como null
      setUser(null);
    } finally {
      // SEMPRE executar para remover o loading
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    // Primeiro, obter o CSRF cookie
    await api.get('/sanctum/csrf-cookie');
    
    // Então fazer o login
    const response = await api.post('/api/login', { email, password });
    setUser(response.data.user);
  };

  const logout = async () => {
    try {
      await api.post('/api/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // SEMPRE limpar o usuário, mesmo se a requisição falhar
      setUser(null);
    }
  };

  const isHR = () => user?.role === 'hr';
  const isManager = () => user?.role === 'manager';
  const canManageUsers = () => user?.role === 'hr' || user?.role === 'manager';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        isHR,
        isManager,
        canManageUsers,
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
