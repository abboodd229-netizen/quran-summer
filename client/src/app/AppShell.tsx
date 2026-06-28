import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useAppState } from './AppState';
import { NAV } from './nav';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

function SaveIndicator() {
  const { saveStatus, savedAt } = useAppState();
  const map = {
    idle: { t: '', c: 'text-muted' },
    saving: { t: 'يُحفظ…', c: 'text-muted' },
    saved: { t: `تم الحفظ ${savedAt ?? ''} ✓`, c: 'text-brand-600' },
    error: { t: 'تعذّر الحفظ — يُعاد المحاولة', c: 'text-danger' },
  } as const;
  const s = map[saveStatus];
  if (!s.t) return null;
  return <span className={`text-xs font-medium ${s.c}`}>{s.t}</span>;
}

function WeekSwitcher() {
  const { weeks, weekId, setWeekId, currentWeek, refreshWeeks } = useAppState();
  const { user } = useAuth();
  const toast = useToast();
  const [locking, setLocking] = useState(false);

  const toggleLock = async () => {
    if (!weekId) return;
    setLocking(true);
    try {
      await api.patch(`/weeks/${weekId}/lock`);
      await refreshWeeks();
      toast('success', currentWeek?.isLocked ? 'تم فتح الأسبوع' : 'تم قفل الأسبوع');
    } catch (e) { toast('error', (e as Error).message); }
    setLocking(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={weekId ?? ''}
        onChange={(e) => setWeekId(Number(e.target.value))}
        className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium outline-none focus:border-brand-600"
      >
        {weeks.map((w) => (
          <option key={w.id} value={w.id}>{w.isLocked ? `🔒 ${w.label}` : w.label}</option>
        ))}
      </select>
      {user?.role === 'admin' && currentWeek && (
        <button
          disabled={locking}
          onClick={toggleLock}
          title={currentWeek.isLocked ? 'فتح الأسبوع للتعديل' : 'قفل الأسبوع'}
          className="rounded-lg px-2 py-1.5 text-base hover:bg-brand-50 disabled:opacity-50"
        >
          {currentWeek.isLocked ? '🔓' : '🔒'}
        </button>
      )}
    </div>
  );
}

export function AppShell() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => {
    if (n.adminOnly) return user?.role === 'admin';
    if (!n.perms) return true;
    return can(...n.perms);
  });

  const doLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      {/* الشريط الجانبي */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-64 shrink-0 border-l border-line bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-line px-4">
          <img
            src="/logo.png"
            alt="شعار الجمعية"
            className="h-10 w-10 shrink-0 rounded-xl object-contain bg-white p-0.5 ring-1 ring-line"
            onError={(e) => {
              const t = e.currentTarget;
              t.style.display = 'none';
              (t.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
            }}
          />
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-[17px] font-bold text-white ring-1 ring-brand-800/20">
            ق
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-extrabold text-brand-700">الحلقات الصيفية 1448هـ</div>
            <div className="truncate text-[10px] text-muted">الجمعية الخيرية لتحفيظ القرآن الكريم بجازان</div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-brand-700 text-white' : 'text-ink hover:bg-brand-50'
                }`
              }
            >
              <span className="shrink-0 w-5 text-center text-base">{n.icon}</span>
              <span className="truncate">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 inset-x-0 border-t border-line p-3">
          <Link to="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-brand-50">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-brand-700 font-bold">
              {user?.name?.[0] ?? '؟'}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{user?.name}</div>
              <div className="text-[11px] text-muted">{user?.role === 'admin' ? 'مدير' : 'مساعد'}</div>
            </div>
          </Link>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setOpen(false)} />}

      {/* المحتوى */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-cream/90 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 hover:bg-brand-50 lg:hidden" onClick={() => setOpen(true)} aria-label="القائمة">☰</button>
            <WeekSwitcher />
          </div>
          <div className="flex items-center gap-4">
            <SaveIndicator />
            <button onClick={doLogout} className="btn btn-sm btn-ghost">خروج</button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
