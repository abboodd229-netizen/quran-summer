import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AuditLog } from '@quran/shared';
import { api } from '@/lib/api';
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';

const actionLabels: Record<string, string> = {
  login: 'تسجيل دخول', evaluate: 'تقييم', clear: 'مسح تقييم', draw: 'سحب', finalize: 'اعتماد سحب',
  select_excellence: 'اختيار متميّز', create: 'إنشاء', update: 'تعديل', move: 'نقل', delete: 'حذف',
  import: 'استيراد', change_password: 'تغيير كلمة المرور',
};
const entityLabels: Record<string, string> = {
  session: 'جلسة', student_event: 'تقييم', lottery: 'سحب', excellence: 'تميّز', student: 'طالب',
  user: 'مستخدم', settings: 'إعدادات',
};

export function ActivityPage() {
  const [action, setAction] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['audit', action],
    queryFn: () => api.get<{ logs: AuditLog[] }>(`/audit?limit=200${action ? `&action=${action}` : ''}`),
  });

  return (
    <div>
      <PageHeader title="سجل النشاط" subtitle="سجل التدقيق الكامل لكل الإجراءات" />
      <div className="mb-4">
        <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="">كل الإجراءات</option>
          {Object.entries(actionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-5 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : (data?.logs.length ?? 0) === 0 ? (
          <EmptyState title="لا نشاط مطابق للفلاتر" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-brand-50 text-brand-700"><tr><th className="p-3 text-right">المستخدم</th><th className="p-3 text-right">الإجراء</th><th className="p-3 text-right">العنصر</th><th className="p-3 text-right">الوقت</th></tr></thead>
            <tbody>
              {data?.logs.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="p-3 font-medium">{l.userName ?? '—'}</td>
                  <td className="p-3">{actionLabels[l.action] ?? l.action}</td>
                  <td className="p-3 text-muted">{entityLabels[l.entity] ?? l.entity}</td>
                  <td className="p-3 text-xs text-muted">{new Date(l.createdAt).toLocaleString('ar')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
