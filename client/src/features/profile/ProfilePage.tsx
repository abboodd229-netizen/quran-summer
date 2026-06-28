import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PERMISSION_LABELS, type Permission } from '@quran/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, PageHeader, TextField } from '@/components/ui';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [loading, setLoading] = useState(false);

  const change = async () => {
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: cur, newPassword: next });
      setCur(''); setNext('');
      toast('success', 'تم تغيير كلمة المرور');
    } catch (e) { toast('error', (e as Error).message); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-xl">
      <PageHeader title="الملف الشخصي" />
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">{user?.name?.[0]}</div>
          <div>
            <div className="font-bold">{user?.name}</div>
            <div className="text-sm text-muted">{user?.username} — {user?.role === 'admin' ? 'مدير' : 'مساعد'}</div>
          </div>
        </div>
        {user?.role !== 'admin' && user?.permissions.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {user.permissions.map((p) => <Chip key={p} variant="ok">{PERMISSION_LABELS[p as Permission]}</Chip>)}
          </div>
        ) : null}
      </Card>

      <Card className="mb-4">
        <div className="mb-3 font-bold text-brand-700">تغيير كلمة المرور</div>
        <div className="space-y-3">
          <TextField label="كلمة المرور الحالية" type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
          <TextField label="كلمة المرور الجديدة" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          <Button onClick={change} loading={loading} disabled={!cur || next.length < 6}>تحديث</Button>
        </div>
      </Card>

      <Button variant="danger" onClick={async () => { await logout(); navigate('/login'); }}>تسجيل الخروج</Button>
    </div>
  );
}
