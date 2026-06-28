import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  CRITERION_LABELS, CRITERION_PERMISSION, DAILY_CRITERIA, WEEK_DAYS, WEEK_DAY_LABELS,
  type Criterion, type EventStatus, type Student, type StudentStatus, type WeekDay,
} from '@quran/shared';
import { api } from '@/lib/api';
import { useAppState } from '@/app/AppState';
import { useAuth } from '@/app/AuthContext';
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { StudentStatusBadge } from '@/components/StudentStatusBadge';

interface Circle { id: number; name: string; groupName: string }
interface GridEvent { studentId: number; criterion: Criterion; status: EventStatus; dayDate: WeekDay | null }
type CellState = 'none' | 'ok' | 'violation';

const TABS: Criterion[] = ['attendance', 'appearance', 'behavior', 'curriculum'];
const cellKey = (sid: number, day: WeekDay | null) => `${sid}:${day ?? ''}`;

export function EvaluationPage() {
  const { weekId, currentWeek, setSaveStatus } = useAppState();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [circleId, setCircleId] = useState<number | null>(params.get('circle') ? Number(params.get('circle')) : null);
  const [tab, setTab] = useState<Criterion>('attendance');
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [statuses, setStatuses] = useState<Record<number, StudentStatus>>({});
  const [lockBanner, setLockBanner] = useState<string | null>(null);

  const { data: circlesData } = useQuery({
    queryKey: ['eval-circles', weekId],
    queryFn: () => api.get<{ circles: Circle[] }>(`/circles?week=${weekId}`),
    enabled: !!weekId,
  });

  // أول حلقة افتراضيًا
  useEffect(() => {
    if (!circleId && circlesData?.circles.length) setCircleId(circlesData.circles[0].id);
  }, [circlesData, circleId]);

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['eval-students', circleId, weekId],
    queryFn: () => api.get<{ students: Student[] }>(`/students?circle=${circleId}&week=${weekId}`),
    enabled: !!circleId && !!weekId,
  });

  const { data: gridData } = useQuery({
    queryKey: ['eval-grid', circleId, weekId],
    queryFn: () => api.get<{ events: GridEvent[] }>(`/events/grid?circle=${circleId}&week=${weekId}`),
    enabled: !!circleId && !!weekId,
  });

  // بناء خرائط الخلايا والحالات عند التحميل
  useEffect(() => {
    if (!gridData) return;
    const map: Record<string, CellState> = {};
    for (const e of gridData.events) {
      map[`${e.criterion}|${cellKey(e.studentId, e.dayDate)}`] = e.status === 'violation' ? 'violation' : 'ok';
    }
    setCells(map);
  }, [gridData]);

  useEffect(() => {
    if (!studentsData) return;
    const map: Record<number, StudentStatus> = {};
    for (const s of studentsData.students) if (s.status) map[s.id] = s.status;
    setStatuses(map);
  }, [studentsData]);

  // قفل التحرير على الحلقة
  useEffect(() => {
    if (!circleId) return;
    const body = { resourceType: 'circle', resourceId: String(circleId) };
    let active = true;
    const acquire = async () => {
      const r = await api.post<{ mine: boolean; by?: string }>('/locks', body).catch(() => null);
      if (active) setLockBanner(r && !r.mine ? `يحرّر هذه الحلقة الآن: ${r.by}` : null);
    };
    acquire();
    const hb = setInterval(acquire, 15000);
    return () => {
      active = false;
      clearInterval(hb);
      api.del('/locks', body).catch(() => {});
    };
  }, [circleId]);

  const days = DAILY_CRITERIA.includes(tab) ? WEEK_DAYS : ([null] as (WeekDay | null)[]);
  const canEdit = can(CRITERION_PERMISSION[tab]);

  const next = (s: CellState): CellState => (s === 'none' ? 'ok' : s === 'ok' ? 'violation' : 'none');

  const setCell = async (studentId: number, day: WeekDay | null, current: CellState) => {
    if (!canEdit || !weekId) return;
    const target = next(current);
    const key = `${tab}|${cellKey(studentId, day)}`;
    setCells((c) => ({ ...c, [key]: target }));
    setSaveStatus('saving');
    try {
      let res: { status: StudentStatus };
      if (target === 'none') {
        res = await api.post('/events/clear', { studentId, weekId, criterion: tab, dayDate: day });
      } else {
        res = await api.post('/events', { studentId, weekId, criterion: tab, status: target, dayDate: day });
      }
      setStatuses((m) => ({ ...m, [studentId]: res.status }));
      setSaveStatus('saved');
    } catch {
      setCells((c) => ({ ...c, [key]: current })); // تراجع
      setSaveStatus('error');
    }
  };

  const students = studentsData?.students ?? [];

  return (
    <div>
      <PageHeader title="التقييم" subtitle="إدخال سريع — حفظ تلقائي فوري" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={circleId ?? ''}
          onChange={(e) => { setCircleId(Number(e.target.value)); setParams({ circle: e.target.value }); }}
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium md:py-3 md:text-base"
        >
          {circlesData?.circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-1 rounded-xl bg-white p-1 border border-line">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium md:px-5 md:py-2.5 md:text-base ${tab === t ? 'bg-brand-700 text-white' : 'text-ink hover:bg-brand-50'}`}>
              {CRITERION_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {currentWeek?.isLocked && <div className="mb-3 rounded-xl bg-gold-100 px-4 py-2 text-sm text-gold-700 font-medium">🔒 هذا الأسبوع مقفل — التقييم للعرض فقط</div>}
      {lockBanner && <div className="mb-3 rounded-xl bg-gold-100 px-4 py-2 text-sm text-gold-700">{lockBanner}</div>}
      {!canEdit && !currentWeek?.isLocked && <div className="mb-3 rounded-xl bg-line px-4 py-2 text-sm text-muted">عرض فقط — لا تملك صلاحية تقييم {CRITERION_LABELS[tab]}</div>}

      <Card className="overflow-x-auto p-0">
        {isLoading ? (
          <div className="p-5 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : students.length === 0 ? (
          <EmptyState title="لا طلاب في هذه الحلقة" />
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-brand-50 text-brand-700">
              <tr>
                <th className="p-3 text-right font-semibold sticky right-0 bg-brand-50 md:p-4">الطالب</th>
                {days.map((d) => <th key={String(d)} className="p-2 text-center font-semibold md:p-3">{d ? WEEK_DAY_LABELS[d] : 'الحالة الأسبوعية'}</th>)}
                <th className="p-3 text-center font-semibold md:p-4">الأهلية</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const st = statuses[s.id];
                const disq = st && !st.lotteryEligible;
                return (
                  <tr key={s.id} className={`border-t border-line ${disq ? 'bg-line/30' : ''}`}>
                    <td className={`p-3 font-medium sticky right-0 md:p-4 md:text-base ${disq ? 'bg-line/30 text-muted' : 'bg-white'}`}>{s.name}</td>
                    {days.map((d) => {
                      const state = cells[`${tab}|${cellKey(s.id, d)}`] ?? 'none';
                      return (
                        <td key={String(d)} className="p-1 text-center md:p-2">
                          <button
                            disabled={!canEdit}
                            onClick={() => setCell(s.id, d, state)}
                            className={`h-9 w-9 rounded-lg border text-base font-bold transition md:h-12 md:w-12 md:rounded-xl md:text-lg ${
                              state === 'ok' ? 'bg-brand-100 border-brand-300 text-brand-700'
                              : state === 'violation' ? 'bg-danger/10 border-danger/40 text-danger'
                              : 'bg-white border-line text-muted/40 hover:border-brand-300'
                            } ${canEdit ? '' : 'cursor-not-allowed'}`}
                            title={state === 'ok' ? 'سليم' : state === 'violation' ? 'مخالفة' : 'غير مُدخل'}
                          >
                            {state === 'ok' ? '✓' : state === 'violation' ? '✗' : '·'}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center md:p-3">
                      <StudentStatusBadge status={st} showReason={false} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">انقر الخلية للتبديل: نقطة (غير مُدخل) ← ✓ سليم ← ✗ مخالفة.</p>
    </div>
  );
}
