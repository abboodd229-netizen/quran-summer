import { useQuery } from '@tanstack/react-query';
import type { Week } from '@quran/shared';
import { api } from '@/lib/api';
import { useAppState } from '@/app/AppState';
import { Card, Chip, PageHeader } from '@/components/ui';

export function WeeksPage() {
  const { weekId, setWeekId } = useAppState();
  const { data } = useQuery({ queryKey: ['weeks-page'], queryFn: () => api.get<{ weeks: Week[] }>('/weeks') });

  return (
    <div>
      <PageHeader title="الأسابيع" subtitle="كل أسبوع مستقل تمامًا — 5 أيام (الأحد–الخميس)" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data?.weeks.map((w) => (
          <Card key={w.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-extrabold text-brand-700">{w.label}</span>
              {w.id === weekId && <Chip variant="ok">الحالي</Chip>}
            </div>
            <p className="text-sm text-muted">خمسة أيام: الأحد إلى الخميس</p>
            <button
              onClick={() => setWeekId(w.id)}
              className={`btn btn-sm ${w.id === weekId ? 'btn-secondary' : 'btn-primary'}`}
            >
              {w.id === weekId ? 'مفتوح' : 'فتح الأسبوع'}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
