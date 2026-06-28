import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SETTING_KEYS } from '@quran/shared';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Button, Card, PageHeader } from '@/components/ui';
import { ApiError } from '@/lib/api';

export function SettingsPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [winners, setWinners] = useState(3);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<{ settings: Record<string, string> }>('/settings') });
  useEffect(() => {
    if (data?.settings?.[SETTING_KEYS.lotteryDefaultWinners]) setWinners(Number(data.settings[SETTING_KEYS.lotteryDefaultWinners]));
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/settings', { lottery_default_winners: winners });
      toast('success', 'تم حفظ الإعدادات');
    } catch (e) { toast('error', (e as Error).message); } finally { setSaving(false); }
  };

  const doImport = async (file: File) => {
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api.upload<{ added: number; unmatched: string[] }>('/students/import', form);
      toast('success', `تمت إضافة ${r.added} طالبًا${r.unmatched.length ? ` — حلقات غير مطابقة: ${r.unmatched.length}` : ''}`);
    } catch (e) { toast('error', (e as Error).message); } finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const doDownloadBackup = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/settings/backup', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('فشل تنزيل النسخة الاحتياطية');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quran-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
      a.click();
      URL.revokeObjectURL(url);
      toast('success', 'تم تنزيل النسخة الاحتياطية');
    } catch (e) { toast('error', (e as Error).message); }
    setDownloading(false);
  };

  const doRestore = async (file: File) => {
    if (!confirm('تحذير: ستُستبدل كل البيانات الحالية عند إعادة تشغيل الخادم. هل أنت متأكد؟')) return;
    setRestoring(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api.upload<{ ok: boolean; message: string }>('/settings/backup/restore', form);
      toast('success', r.message);
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setRestoring(false);
      if (restoreRef.current) restoreRef.current.value = '';
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="الإعدادات" />
      <div className="space-y-4">
        <Card>
          <div className="mb-3 font-bold text-brand-700">السحب</div>
          <label className="block text-sm">العدد الافتراضي للفائزين بكل مجموعة</label>
          <div className="mt-2 flex items-center gap-3">
            <input type="number" min={1} max={50} value={winners} onChange={(e) => setWinners(Number(e.target.value))}
              className="w-24 rounded-xl border border-line px-3 py-2 text-center" />
            <Button onClick={save} loading={saving}>حفظ</Button>
          </div>
        </Card>

        <Card>
          <div className="mb-3 font-bold text-brand-700">استيراد الطلاب (Excel)</div>
          <p className="mb-3 text-sm text-muted">ملف بعمودين: الاسم، الحلقة. تُطابق الحلقات بالاسم.</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          <Button variant="secondary" loading={importing} onClick={() => fileRef.current?.click()}>اختيار ملف واستيراد</Button>
        </Card>

        <Card>
          <div className="mb-3 font-bold text-brand-700">النسخ الاحتياطي والاستعادة</div>
          <p className="mb-4 text-sm text-muted">يُنشأ نسخ تلقائي يومي على الخادم. يمكنك تنزيل نسخة يدوية أو استعادة نسخة سابقة.</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" loading={downloading} onClick={doDownloadBackup}>
              ⬇ تنزيل نسخة احتياطية
            </Button>
            <Button variant="secondary" loading={restoring} onClick={() => restoreRef.current?.click()}>
              ⬆ استعادة من نسخة احتياطية
            </Button>
          </div>
          <input ref={restoreRef} type="file" accept=".sqlite" className="hidden"
            onChange={(e) => e.target.files?.[0] && doRestore(e.target.files[0])} />
          <p className="mt-3 text-xs text-muted">
            ⚠ الاستعادة تتطلب إعادة تشغيل الخادم لتطبيق التغييرات.
          </p>
        </Card>
      </div>
    </div>
  );
}
