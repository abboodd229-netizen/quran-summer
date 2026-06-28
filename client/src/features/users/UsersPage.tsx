import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_LABELS, PERMISSIONS, type Circle, type Permission } from '@quran/shared';
import { api } from '@/lib/api';
import { useAppState } from '@/app/AppState';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Modal, PageHeader, Skeleton, TextField } from '@/components/ui';

interface UserRow { id: number; name: string; username: string; role: string; isActive: boolean; circleCount: number; }
interface UserDetail extends UserRow { permissions: Permission[]; circleIds: number[]; }

const blank = { name: '', username: '', password: '', circleIds: [] as number[], permissions: [] as Permission[] };

export function UsersPage() {
  const { weekId } = useAppState();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(blank);
  const [active, setActive] = useState(true);

  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get<{ users: UserRow[] }>('/users') });
  const { data: circlesData } = useQuery({ queryKey: ['circles-all', weekId], queryFn: () => api.get<{ circles: Circle[] }>(`/circles?week=${weekId}`), enabled: open });

  const openNew = () => { setEditId(null); setForm(blank); setActive(true); setOpen(true); };
  const openEdit = async (id: number) => {
    const { user } = await api.get<{ user: UserDetail }>(`/users/${id}`);
    setEditId(id);
    setForm({ name: user.name, username: user.username, password: '', circleIds: user.circleIds, permissions: user.permissions });
    setActive(user.isActive);
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editId) {
        await api.patch(`/users/${editId}`, { name: form.name, password: form.password || undefined, isActive: active, circleIds: form.circleIds, permissions: form.permissions });
      } else {
        await api.post('/users', { ...form, role: 'assistant' });
      }
    },
    onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ['users'] }); toast('success', 'تم الحفظ'); },
    onError: (e: Error) => toast('error', e.message),
  });

  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div>
      <PageHeader title="إدارة المستخدمين" subtitle="المدير ينشئ المساعدين ويسند لهم الحلقات والصلاحيات" action={<Button onClick={openNew}>مستخدم جديد</Button>} />
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-5 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-brand-50 text-brand-700"><tr><th className="p-3 text-right">الاسم</th><th className="p-3 text-right">المستخدم</th><th className="p-3 text-right">الدور</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">الحلقات</th><th className="p-3"></th></tr></thead>
            <tbody>
              {data?.users.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3 text-muted">{u.username}</td>
                  <td className="p-3">{u.role === 'admin' ? 'مدير' : 'مساعد'}</td>
                  <td className="p-3">{u.isActive ? <Chip variant="ok">مفعّل</Chip> : <Chip variant="gray">معطّل</Chip>}</td>
                  <td className="p-3">{u.circleCount}</td>
                  <td className="p-3 text-left">{u.role !== 'admin' && <button className="text-brand-700 hover:underline" onClick={() => openEdit(u.id)}>تعديل</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'تعديل مستخدم' : 'مستخدم جديد'}
        footer={<><Button onClick={() => saveMut.mutate()} loading={saveMut.isPending}>حفظ</Button><Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button></>}>
        <div className="space-y-3 max-h-[70vh] overflow-auto">
          <TextField label="الاسم" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          {!editId && <TextField label="اسم المستخدم" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />}
          <TextField label={editId ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'} type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          {editId && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> الحساب مفعّل</label>
          )}
          <div>
            <div className="mb-1.5 text-sm font-medium">الحلقات المُسندة</div>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-auto rounded-xl border border-line p-2">
              {circlesData?.circles.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.circleIds.includes(c.id)} onChange={() => setForm((f) => ({ ...f, circleIds: toggle(f.circleIds, c.id) }))} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-sm font-medium">الصلاحيات</div>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-line p-2">
              {PERMISSIONS.filter((p) => p !== 'manage_users' && p !== 'manage_settings').map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => setForm((f) => ({ ...f, permissions: toggle(f.permissions, p) }))} />
                  {PERMISSION_LABELS[p]}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
