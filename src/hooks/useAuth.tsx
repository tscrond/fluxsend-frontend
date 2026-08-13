import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  checkAuth,
  getUserData,
  getUserIdentities,
  getAuthProviders,
  logout as apiLogout,
  getLoginUrl,
  type AuthProviders,
  type UserData,
  type UserIdentity,
} from '@/api';

interface AuthContextValue {
  user: UserData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authProviders: AuthProviders;
  identities: UserIdentity[];
  hasPasswordIdentity: boolean;
  login: (provider: string) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authProviders, setAuthProviders] = useState<AuthProviders>({
    google: false,
    github: false,
    password: false,
  });
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [hasPasswordIdentity, setHasPasswordIdentity] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const providerStatus = await getAuthProviders();
      setAuthProviders(providerStatus);

      const authStatus = await checkAuth();
      if (authStatus.authenticated) {
        const { user_data } = await getUserData();
        setUser(user_data);
        const identitiesResponse = await getUserIdentities();
        setIdentities(identitiesResponse.identities);
        setHasPasswordIdentity(identitiesResponse.has_password_identity);
      } else {
        setUser(null);
        setIdentities([]);
        setHasPasswordIdentity(false);
      }
    } catch {
      setUser(null);
      setIdentities([]);
      setHasPasswordIdentity(false);
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
      authProviders,
      identities,
      hasPasswordIdentity,
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
