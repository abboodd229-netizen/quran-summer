import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExcellenceCircleState } from '@quran/shared';
import { api } from '@/lib/api';
import { useAppState } from '@/app/AppState';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, EmptyState, Modal, PageHeader, Skeleton } from '@/components/ui';

export function ExcellencePage() {
  const { weekId } = useAppState();
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [pick, setPick] = useState<ExcellenceCircleState | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['excellence', weekId],
    queryFn: () => api.get<{ circles: ExcellenceCircleState[] }>(`/excellence?week=${weekId}`),
    enabled: !!weekId,
  });

  const selectMut = useMutation({
    mutationFn: (v: { circleId: number; studentId: number }) =>
      api.post('/excellence', { weekId, circleId: v.circleId, studentId: v.studentId }),
    onSuccess: () => { setPick(null); qc.invalidateQueries({ queryKey: ['excellence', weekId] }); toast('success', 'تم تسجيل المتميّز'); },
    onError: (e: Error) => toast('error', e.message),
  });

  const circles = data?.circles ?? [];
  const decided = circles.filter((c) => c.winner).length;

  return (
    <div>
      <PageHeader title="التميّز الأسبوعي" subtitle="فائز واحد لكل حلقة — مستقل عن السحب" />
      {!isLoading && circles.length > 0 && (
        <div className="mb-4 text-sm text-muted">حُسم متميّز <b className="text-brand-700">{decided}</b> من <b>{circles.length}</b> حلقة</div>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : circles.length === 0 ? (
        <EmptyState title="لا حلقات ضمن نطاقك" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {circles.map((c) => (
            <Card key={c.circleId} className="flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <span className="font-bold">{c.circleName}</span>
                {c.state === 'none' && <Chip variant="gray">لا مؤهل</Chip>}
                {c.state === 'auto' && <Chip variant="gold">تلقائي</Chip>}
                {c.state === 'manual_pending' && <Chip variant="warn">بانتظار الحسم</Chip>}
                {c.state === 'manual_done' && <Chip variant="gold">محسوم</Chip>}
              </div>
              {c.winner ? (
                <div className="flex items-center gap-2">
                  <span className="text-gold-500 text-lg">★</span>
                  <span className="font-semibold">{c.winner.name}</span>
                  {c.winner.auto && <span className="text-xs text-muted">(اختير تلقائيًا)</span>}
                </div>
              ) : c.state === 'none' ? (
                <div className="text-sm text-muted">لا يوجد طالب مؤهل هذا الأسبوع</div>
              ) : (
                <div className="text-sm text-muted">{c.eligibleStudents.length} مؤهلون</div>
              )}
              {c.state === 'manual_pending' && can('select_excellence') && (
                <Button size="sm" className="mt-1" onClick={() => setPick(c)}>اختيار المتميّز</Button>
              )}
              {c.state === 'manual_done' && can('select_excellence') && (
                <button className="mt-1 text-xs text-brand-700 hover:underline self-start" onClick={() => setPick(c)}>تغيير الاختيار</button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!pick} onClose={() => setPick(null)} title={`اختيار متميّز: ${pick?.circleName ?? ''}`}>
        <p className="mb-3 text-sm text-muted">يُختار بعد استشارة المعلّم خارج النظام. اختر طالبًا واحدًا:</p>
        <div className="space-y-2 max-h-80 overflow-auto">
          {pick?.eligibleStudents.map((s) => (
            <button key={s.id} onClick={() => selectMut.mutate({ circleId: pick.circleId, studentId: s.id })}
              className={`block w-full rounded-xl border p-3 text-right hover:bg-brand-50 ${pick.winner?.id === s.id ? 'border-gold-500 bg-gold-100' : 'border-line'}`}>
              {s.name}{pick.winner?.id === s.id && ' ★'}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
