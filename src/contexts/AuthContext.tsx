import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'employee' | 'hr';

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
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for MVP demonstration
const mockUsers: Record<string, User> = {
  'employee@empresa.com': {
    id: '1',
    name: 'Maria Silva',
    email: 'employee@empresa.com',
    role: 'employee',
    department: 'Tecnologia',
    position: 'Desenvolvedora Full Stack',
  },
  'hr@empresa.com': {
    id: '2',
    name: 'João Santos',
    email: 'hr@empresa.com',
    role: 'hr',
    department: 'Recursos Humanos',
    position: 'Gerente de RH',
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string, role: UserRole) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockUser = mockUsers[email] || {
      id: '3',
      name: role === 'hr' ? 'Gestor RH' : 'Colaborador',
      email,
      role,
      department: role === 'hr' ? 'Recursos Humanos' : 'Geral',
      position: role === 'hr' ? 'Analista de RH' : 'Colaborador',
    };
    
    setUser({ ...mockUser, role });
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
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
