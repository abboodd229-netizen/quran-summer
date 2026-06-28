import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Week } from '@quran/shared';
import { api } from '@/lib/api';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AppState {
  weeks: Week[];
  weekId: number | null;
  setWeekId: (id: number) => void;
  currentWeek: Week | null;
  refreshWeeks: () => Promise<void>;
  saveStatus: SaveStatus;
  setSaveStatus: (s: SaveStatus) => void;
  savedAt: string | null;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [weekId, setWeekId] = useState<number | null>(null);
  const [saveStatus, setSaveStatusRaw] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const refreshWeeks = async () => {
    const { weeks: w } = await api.get<{ weeks: Week[] }>('/weeks');
    setWeeks(w.map((wk) => ({ ...wk, isLocked: Boolean(wk.isLocked) })));
  };

  useEffect(() => {
    api.get<{ weeks: Week[] }>('/weeks').then(({ weeks: w }) => {
      const mapped = w.map((wk) => ({ ...wk, isLocked: Boolean(wk.isLocked) }));
      setWeeks(mapped);
      setWeekId((cur) => cur ?? mapped[0]?.id ?? null);
    });
  }, []);

  const setSaveStatus = (s: SaveStatus) => {
    setSaveStatusRaw(s);
    if (s === 'saved') {
      setSavedAt(new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }));
      setTimeout(() => setSaveStatusRaw((cur) => (cur === 'saved' ? 'idle' : cur)), 2500);
    }
  };

  const currentWeek = weeks.find((w) => w.id === weekId) ?? null;

  return (
    <Ctx.Provider value={{ weeks, weekId, setWeekId, currentWeek, refreshWeeks, saveStatus, setSaveStatus, savedAt }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppState() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAppState must be used within AppStateProvider');
  return c;
}
