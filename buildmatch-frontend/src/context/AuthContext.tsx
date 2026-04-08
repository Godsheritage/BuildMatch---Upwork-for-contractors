import React, { createContext, useState, useCallback, useEffect } from 'react';
import type { User } from '../types/user.types';
import type { RegisterPayload } from '../services/auth.service';
import * as authService from '../services/auth.service';
import { TOKEN_KEY } from '../services/api';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  loginWithGoogle: (
    idToken: string,
    role?:   'INVESTOR' | 'CONTRACTOR',
    extras?: { firstName?: string; lastName?: string; phone?: string },
  ) => Promise<{ isNewUser: boolean }>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount using the stored token
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }
    authService
      .getMe()
      .then((userData) => setUser(userData))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: userData, token } = await authService.login({ email, password });
    localStorage.setItem(TOKEN_KEY, token);
    setUser(userData);
  }, []);

  const register = useCallback(async (data: RegisterPayload) => {
    const { user: userData, token } = await authService.register(data);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(userData);
  }, []);

  const loginWithGoogle = useCallback(
    async (
      idToken: string,
      role?:   'INVESTOR' | 'CONTRACTOR',
      extras?: { firstName?: string; lastName?: string; phone?: string },
    ) => {
      const { user: userData, token, isNewUser } = await authService.googleAuth(idToken, role, extras);
      localStorage.setItem(TOKEN_KEY, token);
      setUser(userData);
      return { isNewUser };
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        loginWithGoogle,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Exported for use only by src/hooks/useAuth.ts — do not import directly elsewhere
export { AuthContext };
export type { AuthContextValue };
