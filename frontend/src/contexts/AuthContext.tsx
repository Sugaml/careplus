import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, User } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  setToken: (access: string, refresh?: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('careplus_access_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      localStorage.removeItem('careplus_access_token');
      localStorage.removeItem('careplus_refresh_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    localStorage.setItem('careplus_access_token', res.access_token);
    if (res.refresh_token) localStorage.setItem('careplus_refresh_token', res.refresh_token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore (e.g. already expired)
    } finally {
      localStorage.removeItem('careplus_access_token');
      localStorage.removeItem('careplus_refresh_token');
      setUser(null);
    }
  }, []);

  const setToken = useCallback((access: string, refresh?: string) => {
    localStorage.setItem('careplus_access_token', access);
    if (refresh) localStorage.setItem('careplus_refresh_token', refresh);
    loadUser();
  }, [loadUser]);

  const refreshUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setToken, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
