import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ActivityFeedItem, DashboardData } from '@quran/shared';
import { api } from '@/lib/api';
import { useAppState } from '@/app/AppState';
import { useAuth } from '@/app/AuthContext';
import { useSSE } from '@/lib/sse';
import { Card, PageHeader, ProgressBar, Skeleton, StatCard } from '@/components/ui';

const entityLabel: Record<string, string> = {
  evaluation: 'تقييم',
  student_event: '',
  student: 'طالب',
  excellence: 'تميّز',
  lottery: 'سحب',
  session: 'دخول',
  settings: 'إعدادات',
  user: 'مستخدم',
  circle: 'حلقة',
  week: 'أسبوع',
  backup: 'نسخة احتياطية',
};

const actionLabel: Record<string, string> = {
  create: 'إضافة',
  delete: 'حذف',
  move: 'نقل',
  evaluate: 'تقييم',
  clear: 'مسح تقييم',
  draw: 'سحب',
  finalize: 'اعتماد سحب',
  undo: 'إلغاء اعتماد',
  select_excellence: 'تميّز',
  login: 'تسجيل دخول',
  update: 'تحديث',
  import: 'استيراد',
  lock: 'قفل أسبوع',
  unlock: 'فتح أسبوع',
  clone: 'استنساخ',
  move_students: 'نقل طلاب',
  restore_pending: 'استعادة نسخة احتياطية',
};

export function DashboardPage() {
  const { weekId, currentWeek } = useAppState();
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', weekId],
    queryFn: () => api.get<{ dashboard: DashboardData }>(`/dashboard?week=${weekId}`),
    enabled: !!weekId,
  });
  const { data: act } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.get<{ activity: ActivityFeedItem[] }>(`/dashboard/activity`),
  });

  useSSE({
    activity: () => {
      qc.invalidateQueries({ queryKey: ['activity'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    status: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  const d = data?.dashboard;

  return (
    <div>
      <PageHeader
        title="لوحة المعلومات"
        subtitle={currentWeek ? `نظرة تشغيلية — ${currentWeek.label}` : undefined}
      />

      {isLoading || !d ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          {/* إحصاءات رئيسية */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard
              label="الأسبوع الحالي"
              value={d.week.label}
              hint={d.week.startDate ? `${d.week.startDate} — ${d.week.endDate ?? ''}` : undefined}
            />
            <StatCard
              label="إجمالي الطلاب"
              value={d.totalStudents}
              onClick={() => navigate('/circles')}
            />
            <StatCard
              label="إجمالي الحلقات"
              value={d.totalCircles}
              onClick={() => navigate('/circles')}
            />
            <StatCard
              label="الطلاب المؤهلون"
              value={<span className="text-brand-600">{d.eligibleStudents}</span>}
              hint={`${d.totalStudents > 0 ? Math.round((d.eligibleStudents / d.totalStudents) * 100) : 0}% من الإجمالي`}
            />
            <StatCard
              label="المستبعدون"
              value={
                <span className={d.disqualifiedStudents > 0 ? 'text-danger' : 'text-brand-700'}>
                  {d.disqualifiedStudents}
                </span>
              }
            />
            <StatCard
              label="حلقات بانتظار التقييم"
              value={
                <span className={d.pendingCircles > 0 ? 'text-warn' : 'text-brand-700'}>
                  {d.pendingCircles}
                </span>
              }
              onClick={d.pendingCircles > 0 ? () => navigate('/evaluation') : undefined}
              hint={`${d.completedCircles} مكتملة`}
            />
          </div>

          {/* شريط التقدم */}
          <Card className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold">تقدّم تقييم الأسبوع</span>
              <span className="text-sm font-bold text-brand-700">{d.progress}%</span>
            </div>
            <ProgressBar value={d.progress} />
            <div className="mt-2 flex justify-between text-xs text-muted">
              <span>{d.completedCircles} حلقة مكتملة</span>
              <span>{d.pendingCircles > 0 ? `${d.pendingCircles} حلقة معلّقة` : '✓ كل الحلقات مكتملة'}</span>
            </div>
          </Card>

          {/* إجراءات سريعة + نشاط مباشر */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-3 font-semibold">إجراءات سريعة</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {can('evaluate_attendance', 'evaluate_appearance', 'evaluate_behavior', 'evaluate_curriculum') && (
                  <button className="btn btn-md btn-primary w-full" onClick={() => navigate('/evaluation')}>
                    ✦ إدخال تقييم
                  </button>
                )}
                {can('run_lottery') && (
                  <button className="btn btn-md btn-secondary w-full" onClick={() => navigate('/lottery')}>
                    ◈ تشغيل سحب
                  </button>
                )}
                {can('select_excellence') && (
                  <button className="btn btn-md btn-secondary w-full" onClick={() => navigate('/excellence')}>
                    ★ التميّز
                  </button>
                )}
                {can('export_reports') && (
                  <button className="btn btn-md btn-secondary w-full" onClick={() => navigate('/reports')}>
                    ▤ التقارير
                  </button>
                )}
              </div>
            </Card>

            <Card>
              <div className="mb-3 font-semibold">نشاط مباشر</div>
              <div className="space-y-2.5">
                {(act?.activity ?? []).length === 0 ? (
                  <div className="text-sm text-muted">لا نشاط بعد</div>
                ) : (
                  act?.activity?.map((a) => (
                    <div key={a.id} className="flex items-start justify-between gap-2 text-sm">
                      <span className="leading-snug">
                        <span className="font-medium">{a.userName ?? 'مستخدم'}</span>
                        <span className="text-muted">
                          {' — '}
                          {actionLabel[a.action] ?? a.action}
                          {' '}
                          {entityLabel[a.entity] ?? a.entity}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {new Date(a.createdAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
