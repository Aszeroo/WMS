import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (nextUser: User) => void;
  clearUser: () => void;
  canWrite: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiService.me().then((nextUser) => {
      if (mounted) setUser(nextUser);
    }).catch(() => {
      if (mounted) setUser(null);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await apiService.login({ identifier, password });
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiService.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((nextUser: User) => setUser(nextUser), []);
  const clearUser = useCallback(() => setUser(null), []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login,
    logout,
    updateUser,
    clearUser,
    canWrite: user?.role === 'admin' || user?.role === 'staff',
    isAdmin: user?.role === 'admin',
  }), [user, loading, login, logout, updateUser, clearUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
