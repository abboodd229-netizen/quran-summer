import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppState } from '@/app/AppState';
import { Button, Card, Chip, PageHeader, Skeleton } from '@/components/ui';
import type { WeeklyReport } from './types';

export function ReportsPage() {
  const { weekId, currentWeek } = useAppState();
  const { data, isLoading } = useQuery({
    queryKey: ['report', weekId],
    queryFn: () => api.get<{ report: WeeklyReport }>(`/reports/week/${weekId}`),
    enabled: !!weekId,
  });
  const r = data?.report;

  return (
    <div>
      <PageHeader
        title="التقارير"
        subtitle={currentWeek?.label}
        action={<Button onClick={() => window.open(`/api/reports/week/${weekId}/print`, '_blank')}>تصدير PDF</Button>}
      />
      {isLoading || !r ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card><div className="text-2xl font-extrabold text-brand-700">{r.stats.totalStudents}</div><div className="text-sm text-muted">الطلاب</div></Card>
            <Card><div className="text-2xl font-extrabold text-brand-700">{r.stats.eligible}</div><div className="text-sm text-muted">المؤهلون</div></Card>
            <Card><div className="text-2xl font-extrabold text-brand-700">{r.stats.disqualified}</div><div className="text-sm text-muted">المستبعدون</div></Card>
            <Card><div className="text-2xl font-extrabold text-brand-700">{r.stats.excellenceDecided}/{r.stats.totalCircles}</div><div className="text-sm text-muted">متميّزو الحلقات</div></Card>
          </div>

          <Card>
            <div className="mb-3 font-bold text-brand-700">الفائزون بالسحب</div>
            <div className="space-y-2">
              {r.lottery.map((l) => (
                <div key={l.groupName} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0">
                  <span className="font-medium">{l.groupName}</span>
                  <div className="flex flex-wrap gap-2">
                    {l.winners.length ? l.winners.map((w) => <span key={w} className="chip chip-gold">★ {w}</span>) : <span className="text-sm text-muted">لم يُجرَ</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-3 font-bold text-brand-700">متميّز كل حلقة</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {r.excellence.map((e) => (
                <div key={e.circleName} className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
                  <span className="text-sm">{e.circleName}</span>
                  {e.winner ? <span className="font-medium text-gold-700">★ {e.winner}</span> : <Chip variant="gray">{e.state}</Chip>}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-3 font-bold text-brand-700">المستبعدون وأسبابهم ({r.disqualified.length})</div>
            {r.disqualified.length === 0 ? (
              <div className="text-sm text-muted">لا يوجد مستبعدون</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-brand-700"><tr><th className="p-2 text-right">الطالب</th><th className="p-2 text-right">الحلقة</th><th className="p-2 text-right">السبب</th></tr></thead>
                <tbody>
                  {r.disqualified.map((d, i) => (
                    <tr key={i} className="border-t border-line text-muted"><td className="p-2">{d.name}</td><td className="p-2">{d.circleName}</td><td className="p-2">{d.reasons.join('، ')}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
