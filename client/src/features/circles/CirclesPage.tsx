import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAppState } from '@/app/AppState';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, EmptyState, Modal, PageHeader, ProgressBar, Skeleton, TextField } from '@/components/ui';

import type { Group, Track } from '@quran/shared';

const CIRCLE_PREFIXES: Record<string, string> = {
  'القاعدة المدنية': 'الحلقة التأسيسية',
  'جزأين': 'حلقة جزأين',
  'ثلاثة أجزاء': 'حلقة ثلاثة أجزاء',
  'خمسة أجزاء': 'حلقة خمسة أجزاء',
  'عشرة أجزاء': 'حلقة عشرة أجزاء',
  'خمسة عشر جزءاً': 'حلقة خمسة عشر جزءًا',
  'عشرون جزءاً': 'حلقة عشرين جزءًا',
  'خمسة وعشرون جزءاً': 'حلقة خمسة وعشرين جزءًا',
  'القرآن كاملاً': 'حلقة القرآن كاملًا',
};

interface CircleStat {
  id: number; name: string; groupId: number; groupName: string; trackId?: number; teacherName?: string | null;
  studentCount: number; eligibleCount: number; disqualifiedCount: number; progress: number; completed: boolean;
}

export function CirclesPage() {
  const { weekId } = useAppState();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [group, setGroup] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newCircleGroupId, setNewCircleGroupId] = useState<number>(0);
  const [newTeacherName, setNewTeacherName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['circles', weekId],
    queryFn: () => api.get<{ circles: CircleStat[] }>(`/circles?week=${weekId}`),
    enabled: !!weekId,
  });
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get<{ groups: Group[] }>('/groups'),
    enabled: user?.role === 'admin',
  });
  const { data: tracksData } = useQuery({
    queryKey: ['tracks'],
    queryFn: () => api.get<{ tracks: Track[] }>('/tracks'),
    enabled: user?.role === 'admin',
  });
  const [newCircleTrackId, setNewCircleTrackId] = useState<number>(0);

  const autoSuggestGroup = (trackId: number) => {
    const track = tracksData?.tracks.find((t) => t.id === trackId);
    if (track?.defaultLotteryGroupId) setNewCircleGroupId(track.defaultLotteryGroupId);
  };

  const createMut = useMutation({
    mutationFn: () => api.post('/circles', { groupId: newCircleGroupId, trackId: newCircleTrackId, teacherName: newTeacherName.trim() || undefined }),
    onSuccess: () => {
      setCreateOpen(false); setNewCircleGroupId(0); setNewCircleTrackId(0); setNewTeacherName('');
      qc.invalidateQueries({ queryKey: ['circles'] });
      toast('success', 'تم إنشاء الحلقة');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const allCircles = data?.circles ?? [];
  const groups = [...new Set(allCircles.map((c) => c.groupName))];
  let circles = allCircles;
  if (q) circles = circles.filter((c) => c.name.includes(q) || (c.teacherName ?? '').includes(q));
  if (group) circles = circles.filter((c) => c.groupName === group);
  if (filter === 'pending') circles = circles.filter((c) => !c.completed);
  if (filter === 'done') circles = circles.filter((c) => c.completed);

  return (
    <div>
      <PageHeader
        title="الحلقات"
        subtitle="اختر حلقة لإدارة التقييم والطلاب"
        action={user?.role === 'admin' ? <Button size="sm" onClick={() => setCreateOpen(true)}>+ إنشاء حلقة</Button> : undefined}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="w-52">
          <TextField placeholder="بحث باسم الحلقة أو المعلم" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium outline-none focus:border-brand-600"
        >
          <option value="">كل المجموعات</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        {(['all', 'pending', 'done'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}>
            {f === 'all' ? 'الكل' : f === 'pending' ? 'معلّقة' : 'مكتملة'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : circles.length === 0 ? (
        <EmptyState title="لا حلقات مطابقة" hint="جرّب تغيير البحث أو الفلتر" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {circles.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:shadow-pop transition" >
              <button className="w-full text-right" onClick={() => navigate(`/circles/${c.id}`)}>
                <div className="flex items-start justify-between">
                  <span className="font-bold">{c.name}</span>
                  {c.completed ? <Chip variant="ok">مكتملة</Chip> : <Chip variant="gray">معلّقة</Chip>}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {c.trackName ? <span>{c.trackName} · </span> : null}{c.groupName}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  المعلم: {c.teacherName ?? '—'}
                </div>
                <div className="mt-3 flex gap-3 text-sm">
                  <span>الطلاب: <b>{c.studentCount}</b></span>
                  <span className="text-brand-600">مؤهل: <b>{c.eligibleCount}</b></span>
                  <span className="text-muted">مستبعد: <b>{c.disqualifiedCount}</b></span>
                </div>
                <div className="mt-3"><ProgressBar value={c.progress} /></div>
                <div className="mt-1 text-xs text-muted">{c.progress}% تقييم</div>
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* نافذة إنشاء حلقة */}
      {(() => {
        const selectedTrack = tracksData?.tracks.find((t) => t.id === newCircleTrackId);
        const prefix = selectedTrack ? (CIRCLE_PREFIXES[selectedTrack.name] ?? `حلقة ${selectedTrack.name}`) : '';
        const trackCount = allCircles.filter((c) => c.trackId === newCircleTrackId).length;
        const previewName = prefix ? `${prefix} (${trackCount + 1})` : '';
        return (
          <Modal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            title="إنشاء حلقة جديدة"
            footer={
              <>
                <Button
                  loading={createMut.isPending}
                  disabled={!newCircleTrackId || !newCircleGroupId}
                  onClick={() => createMut.mutate()}
                >إنشاء</Button>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>إلغاء</Button>
              </>
            }
          >
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">المسار التعليمي</label>
                <select
                  value={newCircleTrackId}
                  onChange={(e) => { const id = Number(e.target.value); setNewCircleTrackId(id); autoSuggestGroup(id); }}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
                  autoFocus
                >
                  <option value={0}>اختر مسارًا</option>
                  {tracksData?.tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">مجموعة السحب</label>
                <select
                  value={newCircleGroupId}
                  onChange={(e) => setNewCircleGroupId(Number(e.target.value))}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
                >
                  <option value={0}>اختر مجموعة</option>
                  {groupsData?.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <p className="mt-1 text-xs text-muted">تُملأ تلقائيًا عند اختيار المسار</p>
              </div>
              <TextField
                label="اسم المعلم (اختياري)"
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
                placeholder="اترك فارغًا إن لم يُعيَّن بعد"
              />
              {previewName && (
                <div className="rounded-xl bg-brand-50 px-4 py-2.5 text-sm">
                  <span className="text-muted">سيتم تسمية الحلقة: </span>
                  <span className="font-bold text-brand-700">{previewName}</span>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
