import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Lottery } from '@quran/shared';
import { api } from '@/lib/api';
import { useAppState } from '@/app/AppState';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Modal, PageHeader, Skeleton } from '@/components/ui';

interface PendingDraw {
  groupId: number;
  groupName: string;
  winnersCount: number;
  isRedo: boolean;
}

export function LotteryControlPage() {
  const { weekId, currentWeek } = useAppState();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [pendingDraw, setPendingDraw] = useState<PendingDraw | null>(null);
  const [pendingUndo, setPendingUndo] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['lotteries', weekId],
    queryFn: () => api.get<{ lotteries: Lottery[]; defaultWinners: number }>(`/lotteries?week=${weekId}`),
    enabled: !!weekId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['lotteries', weekId] });

  const drawMut = useMutation({
    mutationFn: (v: { groupId: number; winnersCount: number }) =>
      api.post('/lotteries/draw', { weekId, groupId: v.groupId, winnersCount: v.winnersCount }),
    onSuccess: () => { invalidate(); toast('success', 'تم تنفيذ السحب'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const finalizeMut = useMutation({
    mutationFn: (id: number) => api.post(`/lotteries/${id}/finalize`),
    onSuccess: () => { invalidate(); toast('success', 'تم اعتماد السحب نهائيًا'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const undoMut = useMutation({
    mutationFn: (id: number) => api.post(`/lotteries/${id}/undo`),
    onSuccess: () => { invalidate(); toast('success', 'تم إلغاء اعتماد السحب'); },
    onError: (e: Error) => toast('error', e.message),
  });

  const openPresentation = () => window.open(`/present/lottery?week=${weekId}`, '_blank', 'noopener');

  return (
    <div>
      <PageHeader
        title="السحب الأسبوعي"
        subtitle={currentWeek ? `${currentWeek.label} — لكل مجموعة سحب مستقل` : undefined}
        action={<Button variant="secondary" onClick={openPresentation}>فتح شاشة العرض</Button>}
      />

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className="space-y-3">
          {data?.lotteries.map((l) => {
            const cnt = counts[l.groupId] ?? l.winnersCount ?? data.defaultWinners;
            const isFinal = l.status === 'final';
            const hasDraft = l.winners.length > 0;
            return (
              <Card key={l.groupId}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">{l.groupName}</div>
                    <div className="text-sm text-muted">المؤهلون للسحب: {l.eligibleCount}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isFinal
                      ? <Chip variant="gold">معتمد</Chip>
                      : hasDraft ? <Chip variant="warn">مسودّة</Chip>
                      : <Chip variant="gray">لم يُجرَ</Chip>}

                    {!isFinal && (
                      <>
                        <label className="text-sm text-muted">الفائزون</label>
                        <input
                          type="number" min={1} max={50} value={cnt}
                          onChange={(e) => setCounts((c) => ({ ...c, [l.groupId]: Number(e.target.value) }))}
                          className="w-16 rounded-lg border border-line px-2 py-1.5 text-center text-sm"
                        />
                        <Button
                          size="sm"
                          disabled={l.eligibleCount === 0}
                          loading={drawMut.isPending && drawMut.variables?.groupId === l.groupId}
                          onClick={() => setPendingDraw({ groupId: l.groupId, groupName: l.groupName, winnersCount: cnt, isRedo: hasDraft })}
                        >
                          {hasDraft ? 'إعادة السحب' : 'ابدأ السحب'}
                        </Button>
                        {hasDraft && l.id > 0 && (
                          <Button size="sm" variant="gold"
                            loading={finalizeMut.isPending && finalizeMut.variables === l.id}
                            onClick={() => finalizeMut.mutate(l.id)}>
                            اعتماد
                          </Button>
                        )}
                      </>
                    )}

                    {isFinal && user?.role === 'admin' && (
                      <Button size="sm" variant="danger" onClick={() => setPendingUndo(l.id)}>
                        إلغاء الاعتماد
                      </Button>
                    )}
                  </div>
                </div>
                {l.winners.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {l.winners.map((w) => (
                      <span key={w.studentId} className="chip chip-gold">★ {w.studentName}</span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* نافذة تأكيد السحب */}
      <Modal
        open={!!pendingDraw}
        onClose={() => setPendingDraw(null)}
        title="تأكيد تنفيذ السحب"
        footer={
          <>
            <Button
              loading={drawMut.isPending}
              onClick={() => { if (pendingDraw) { drawMut.mutate({ groupId: pendingDraw.groupId, winnersCount: pendingDraw.winnersCount }); setPendingDraw(null); } }}
            >
              تنفيذ السحب
            </Button>
            <Button variant="ghost" onClick={() => setPendingDraw(null)}>إلغاء</Button>
          </>
        }
      >
        <p className="text-sm">
          سيتم سحب <b>{pendingDraw?.winnersCount}</b> فائزًا من مجموعة <b>{pendingDraw?.groupName}</b>.
        </p>
        {pendingDraw?.isRedo && (
          <p className="mt-2 text-sm text-warn">⚠ سيتم استبدال نتيجة السحب الحالية بنتيجة جديدة.</p>
        )}
      </Modal>

      {/* نافذة تأكيد إلغاء الاعتماد */}
      <Modal
        open={!!pendingUndo}
        onClose={() => setPendingUndo(null)}
        title="إلغاء اعتماد السحب"
        footer={
          <>
            <Button
              variant="danger"
              loading={undoMut.isPending}
              onClick={() => { if (pendingUndo) { undoMut.mutate(pendingUndo); setPendingUndo(null); } }}
            >
              إلغاء الاعتماد
            </Button>
            <Button variant="ghost" onClick={() => setPendingUndo(null)}>إلغاء</Button>
          </>
        }
      >
        <p className="text-sm">سيتم إلغاء اعتماد السحب وحذف نتائجه. يمكن إعادة السحب بعدها.</p>
        <div className="mt-3 space-y-1 text-sm text-muted">
          <div>✓ التقييمات والحضور لن تتأثر</div>
          <div>✓ سجل التدقيق محفوظ</div>
          <div>✓ الأهلية تبقى كما هي</div>
        </div>
      </Modal>
    </div>
  );
}
