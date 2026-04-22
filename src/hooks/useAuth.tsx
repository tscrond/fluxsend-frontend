import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { checkAuth, getUserData, logout as apiLogout, getLoginUrl, type UserData } from '@/api';

interface AuthContextValue {
  user: UserData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (provider: string) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const authStatus = await checkAuth();
      if (authStatus.authenticated) {
        const { user_data } = await getUserData();
        setUser(user_data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback((provider: string) => {
    window.location.href = getLoginUrl(provider);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  return (
    <AuthContext value={{
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      logout,
      refresh,
    }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
