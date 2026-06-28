import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import type { Student, TimelineItem } from '@quran/shared';
import { api } from '@/lib/api';
import { useAppState } from '@/app/AppState';
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { StudentStatusBadge } from '@/components/StudentStatusBadge';

export function StudentTimelinePage() {
  const { id } = useParams();
  const { weekId } = useAppState();
  const { data, isLoading } = useQuery({
    queryKey: ['timeline', id, weekId],
    queryFn: () => api.get<{ student: Student & { circleName: string }; timeline: TimelineItem[] }>(
      `/students/${id}/timeline?week=${weekId}`,
    ),
    enabled: !!weekId,
  });

  const st = data?.student.status;

  return (
    <div>
      <PageHeader title={data?.student.name ?? 'الطالب'} subtitle={data?.student.circleName} />
      {st && (
        <div className="mb-4 rounded-xl border border-line bg-white px-4 py-3 inline-flex">
          <StudentStatusBadge status={st} showReason />
        </div>
      )}
      <Card>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.timeline.length ?? 0) === 0 ? (
          <EmptyState title="لا أحداث مسجّلة لهذا الطالب في هذا الأسبوع" />
        ) : (
          <ol className="relative space-y-4 border-r-2 border-line pr-4">
            {data?.timeline.map((t) => (
              <li key={`${t.kind}-${t.id}`} className="relative">
                <span className="absolute -right-[22px] top-1.5 h-3 w-3 rounded-full bg-brand-600" />
                <div className="text-sm font-medium">{t.title}</div>
                {t.detail && <div className="text-sm text-muted">{t.detail}</div>}
                <div className="text-xs text-muted">
                  {new Date(t.at).toLocaleString('ar')} {t.by ? `— ${t.by}` : ''}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
