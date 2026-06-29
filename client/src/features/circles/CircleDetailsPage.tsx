import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Circle, Group, Student, Track } from '@quran/shared';
import { api } from '@/lib/api';
import { useAppState } from '@/app/AppState';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/components/Toast';
import { Button, Card, EmptyState, Modal, PageHeader, Skeleton, TextField } from '@/components/ui';
import { StudentStatusBadge } from '@/components/StudentStatusBadge';

export function CircleDetailsPage() {
  const { id } = useParams();
  const circleId = Number(id);
  const { weekId } = useAppState();
  const { user, can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [moveFor, setMoveFor] = useState<Student | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'eligible' | 'disqualified'>('all');
  // Circle management state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGroupId, setEditGroupId] = useState<number>(0);
  const [editTrackId, setEditTrackId] = useState<number>(0);
  const [editTeacherName, setEditTeacherName] = useState('');
  const [cloneOpen, setCloneOpen] = useState(false);
  const [moveAllOpen, setMoveAllOpen] = useState(false);

  const { data: circleData } = useQuery({
    queryKey: ['circle', circleId, weekId],
    queryFn: () => api.get<{ circle: Circle }>(`/circles/${circleId}?week=${weekId}`),
    enabled: !!weekId,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['students', circleId, weekId],
    queryFn: () => api.get<{ students: Student[] }>(`/students?circle=${circleId}&week=${weekId}`),
    enabled: !!weekId,
  });
  const { data: allCircles } = useQuery({
    queryKey: ['circles-min', weekId],
    queryFn: () => api.get<{ circles: Circle[] }>(`/circles?week=${weekId}`),
    enabled: !!moveFor || !!moveAllOpen,
  });
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get<{ groups: Group[] }>('/groups'),
    enabled: editOpen,
  });
  const { data: tracksData } = useQuery({
    queryKey: ['tracks'],
    queryFn: () => api.get<{ tracks: Track[] }>('/tracks'),
    enabled: editOpen,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['students', circleId] });
    qc.invalidateQueries({ queryKey: ['circle', circleId] });
    qc.invalidateQueries({ queryKey: ['circles'] });
  };

  const editMut = useMutation({
    mutationFn: () => api.patch(`/circles/${circleId}`, {
      name: editName.trim() || undefined,
      groupId: editGroupId || undefined,
      trackId: editTrackId || null,
      teacherName: editTeacherName.trim() || null,
    }),
    onSuccess: () => { setEditOpen(false); invalidate(); toast('success', 'تم تحديث الحلقة'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const deleteMut = useMutation({
    mutationFn: () => api.del(`/circles/${circleId}`),
    onSuccess: () => { navigate('/circles'); qc.invalidateQueries({ queryKey: ['circles'] }); toast('success', 'تم حذف الحلقة'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const cloneMut = useMutation({
    mutationFn: () => api.post(`/circles/${circleId}/clone`, {}),
    onSuccess: (r: { id: number; name: string }) => {
      setCloneOpen(false);
      qc.invalidateQueries({ queryKey: ['circles'] });
      toast('success', `تم إنشاء: ${r.name}`);
      navigate(`/circles/${r.id}`);
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const moveAllMut = useMutation({
    mutationFn: (targetCircleId: number) => api.post(`/circles/${circleId}/move-students`, { targetCircleId }),
    onSuccess: (r: { moved: number }) => {
      setMoveAllOpen(false); invalidate();
      toast('success', `تم نقل ${r.moved} طالب`);
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const addMut = useMutation({
    mutationFn: () => api.post('/students', { name: newName.trim(), circleId }),
    onSuccess: () => { setAddOpen(false); setNewName(''); invalidate(); toast('success', 'تمت إضافة الطالب'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const moveMut = useMutation({
    mutationFn: (toCircle: number) => api.patch(`/students/${moveFor!.id}`, { circleId: toCircle }),
    onSuccess: () => { setMoveFor(null); invalidate(); toast('success', 'تم نقل الطالب'); },
    onError: (e: Error) => toast('error', e.message),
  });
  const delMut = useMutation({
    mutationFn: (sid: number) => api.del(`/students/${sid}`),
    onSuccess: () => { invalidate(); toast('success', 'تم حذف الطالب'); },
    onError: (e: Error) => toast('error', e.message),
  });

  const c = circleData?.circle;
  let students = data?.students ?? [];
  if (search) students = students.filter((s) => s.name.includes(search));
  if (statusFilter === 'eligible') students = students.filter((s) => !s.status || s.status.lotteryEligible);
  if (statusFilter === 'disqualified') students = students.filter((s) => s.status && !s.status.lotteryEligible);

  const openEdit = () => {
    setEditName(c?.name ?? '');
    setEditGroupId(c?.groupId ?? 0);
    setEditTrackId(c?.trackId ?? 0);
    setEditTeacherName(c?.teacherName ?? '');
    setEditOpen(true);
  };

  return (
    <div>
      <PageHeader
        title={c?.name ?? 'الحلقة'}
        subtitle={[c?.trackName, c?.groupName, c?.teacherName ? `المعلم: ${c.teacherName}` : null].filter(Boolean).join(' · ') || undefined}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate(`/evaluation?circle=${circleId}`)}>التقييم</Button>
            {can('manage_students') && <Button size="sm" onClick={() => setAddOpen(true)}>إضافة طالب</Button>}
            {user?.role === 'admin' && (
              <>
                <Button variant="secondary" size="sm" onClick={openEdit}>تعديل</Button>
                <Button variant="secondary" size="sm" onClick={() => setCloneOpen(true)}>استنساخ</Button>
                <Button variant="secondary" size="sm" onClick={() => setMoveAllOpen(true)}>نقل الطلاب</Button>
                {c && (data?.students?.length ?? 0) === 0 && (
                  <Button variant="danger" size="sm" loading={deleteMut.isPending}
                    onClick={() => { if (confirm(`حذف حلقة "${c.name}"؟ لا يمكن التراجع.`)) deleteMut.mutate(); }}>
                    حذف
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-56">
          <TextField
            placeholder="بحث باسم الطالب"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {(['all', 'eligible', 'disqualified'] as const).map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`btn btn-sm ${statusFilter === f ? 'btn-primary' : 'btn-secondary'}`}>
            {f === 'all' ? 'الكل' : f === 'eligible' ? '🟢 مؤهل' : '⚪ مستبعد'}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-5 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : students.length === 0 ? (
          <EmptyState title="لا طلاب في هذه الحلقة" action={can('manage_students') && <Button onClick={() => setAddOpen(true)}>إضافة طالب</Button>} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-brand-50 text-brand-700">
              <tr>
                <th className="p-3 text-right font-semibold">الطالب</th>
                <th className="p-3 text-right font-semibold">الحالة</th>
                <th className="p-3 text-right font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const disq = s.status && !s.status.lotteryEligible;
                return (
                  <tr key={s.id} className={`border-t border-line ${disq ? 'bg-line/30 text-muted' : ''}`}>
                    <td className="p-3">
                      <Link to={`/students/${s.id}/timeline`} className="font-medium hover:text-brand-700">{s.name}</Link>
                    </td>
                    <td className="p-3"><StudentStatusBadge status={s.status} /></td>
                    <td className="p-3">
                      {can('manage_students') && (
                        <div className="flex gap-2">
                          <button className="text-brand-700 hover:underline" onClick={() => setMoveFor(s)}>نقل</button>
                          <button className="text-danger hover:underline" onClick={() => { if (confirm(`حذف ${s.name}؟`)) delMut.mutate(s.id); }}>حذف</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="إضافة طالب"
        footer={<><Button onClick={() => addMut.mutate()} loading={addMut.isPending} disabled={!newName.trim()}>إضافة</Button><Button variant="ghost" onClick={() => setAddOpen(false)}>إلغاء</Button></>}>
        <TextField label="اسم الطالب" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
      </Modal>

      <Modal open={!!moveFor} onClose={() => setMoveFor(null)} title={`نقل: ${moveFor?.name ?? ''}`}>
        <div className="space-y-2 max-h-80 overflow-auto">
          {allCircles?.circles.filter((x) => x.id !== circleId).map((x) => (
            <button key={x.id} onClick={() => moveMut.mutate(x.id)} className="block w-full rounded-xl border border-line p-3 text-right hover:bg-brand-50">
              {x.name} <span className="text-xs text-muted">— {x.groupName}</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* تعديل الحلقة */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="تعديل الحلقة"
        footer={
          <>
            <Button loading={editMut.isPending} disabled={!editName.trim()} onClick={() => editMut.mutate()}>حفظ</Button>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>إلغاء</Button>
          </>
        }
      >
        <div className="space-y-3">
          <TextField label="اسم الحلقة" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <TextField
            label="اسم المعلم (اختياري)"
            value={editTeacherName}
            onChange={(e) => setEditTeacherName(e.target.value)}
            placeholder="اتركه فارغًا لحذف الاسم"
          />
          <div>
            <label className="mb-1 block text-sm font-medium">المسار التعليمي</label>
            <select value={editTrackId} onChange={(e) => setEditTrackId(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
              <option value={0}>— بدون مسار —</option>
              {tracksData?.tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">مجموعة السحب</label>
            <select value={editGroupId} onChange={(e) => setEditGroupId(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
              <option value={0}>— لا تغيير —</option>
              {groupsData?.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* استنساخ الحلقة */}
      <Modal open={cloneOpen} onClose={() => setCloneOpen(false)} title="استنساخ الحلقة"
        footer={
          <>
            <Button loading={cloneMut.isPending} onClick={() => cloneMut.mutate()}>استنساخ</Button>
            <Button variant="ghost" onClick={() => setCloneOpen(false)}>إلغاء</Button>
          </>
        }
      >
        <p className="text-sm text-muted">سيتم إنشاء حلقة جديدة فارغة في نفس المسار والمجموعة، وتُسمَّى تلقائيًا بالترتيب التالي.</p>
      </Modal>

      {/* نقل جميع الطلاب */}
      <Modal open={moveAllOpen} onClose={() => setMoveAllOpen(false)} title="نقل جميع الطلاب إلى حلقة أخرى">
        <p className="mb-3 text-sm text-warn">⚠ سيتم نقل جميع الطلاب النشطين من هذه الحلقة.</p>
        <div className="space-y-2 max-h-80 overflow-auto">
          {allCircles?.circles.filter((x) => x.id !== circleId).map((x) => (
            <button key={x.id}
              onClick={() => moveAllMut.mutate(x.id)}
              disabled={moveAllMut.isPending}
              className="block w-full rounded-xl border border-line p-3 text-right hover:bg-brand-50 disabled:opacity-50">
              {x.name} <span className="text-xs text-muted">— {x.groupName}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
