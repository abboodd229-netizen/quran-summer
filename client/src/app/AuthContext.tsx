import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Permission, SessionUser } from '@quran/shared';
import { api } from '@/lib/api';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (...perms: Permission[]) => boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { user } = await api.get<{ user: SessionUser }>('/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const { user } = await api.post<{ user: SessionUser }>('/auth/login', { username, password });
    setUser(user);
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  const can = (...perms: Permission[]) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return perms.some((p) => user.permissions.includes(p));
  };

  return <Ctx.Provider value={{ user, loading, login, logout, can, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
