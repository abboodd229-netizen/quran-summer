// ثوابت المجال المشتركة بين الخادم والعميل (مصدر واحد للحقيقة)

/** المعايير الأربعة للتقييم */
export const CRITERIA = ['attendance', 'appearance', 'behavior', 'curriculum'] as const;
export type Criterion = (typeof CRITERIA)[number];

/** المعايير اليومية (تُدخل عبر شبكة الأيام الخمسة) */
export const DAILY_CRITERIA: Criterion[] = ['attendance', 'appearance', 'behavior'];
/** المعايير الأسبوعية */
export const WEEKLY_CRITERIA: Criterion[] = ['curriculum'];

export const CRITERION_LABELS: Record<Criterion, string> = {
  attendance: 'الحضور',
  appearance: 'المظهر',
  behavior: 'السلوك',
  curriculum: 'المنهج',
};

/** أثر مخالفة كل معيار */
export const CRITERION_BLOCKS: Record<Criterion, { lottery: boolean; excellence: boolean }> = {
  attendance: { lottery: true, excellence: true },
  appearance: { lottery: true, excellence: true },
  behavior: { lottery: true, excellence: true },
  curriculum: { lottery: false, excellence: true },
};

/** حالة الحدث */
export const EVENT_STATUS = ['ok', 'violation'] as const;
export type EventStatus = (typeof EVENT_STATUS)[number];

/** أيام الأسبوع: الأحد إلى الخميس (5 أيام) */
export const WEEK_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];
export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  sun: 'الأحد',
  mon: 'الاثنين',
  tue: 'الثلاثاء',
  wed: 'الأربعاء',
  thu: 'الخميس',
};

export const TOTAL_WEEKS = 4;

/** الأدوار */
export const ROLES = ['admin', 'assistant'] as const;
export type Role = (typeof ROLES)[number];

/** الصلاحيات الذرّية */
export const PERMISSIONS = [
  'view_dashboard',
  'view_circle',
  'view_student_timeline',
  'evaluate_attendance',
  'evaluate_appearance',
  'evaluate_behavior',
  'evaluate_curriculum',
  'run_lottery',
  'select_excellence',
  'manage_students',
  'export_reports',
  'view_audit',
  'manage_users',
  'manage_settings',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  view_dashboard: 'عرض اللوحة',
  view_circle: 'عرض الحلقات',
  view_student_timeline: 'عرض المخطط الزمني',
  evaluate_attendance: 'تقييم الحضور',
  evaluate_appearance: 'تقييم المظهر',
  evaluate_behavior: 'تقييم السلوك',
  evaluate_curriculum: 'تقييم المنهج',
  run_lottery: 'تشغيل السحب',
  select_excellence: 'تحديد المتميّز',
  manage_students: 'إدارة الطلاب',
  export_reports: 'تصدير التقارير',
  view_audit: 'عرض سجل النشاط',
  manage_users: 'إدارة المستخدمين',
  manage_settings: 'إدارة الإعدادات',
};

/** ربط المعيار بصلاحية تقييمه */
export const CRITERION_PERMISSION: Record<Criterion, Permission> = {
  attendance: 'evaluate_attendance',
  appearance: 'evaluate_appearance',
  behavior: 'evaluate_behavior',
  curriculum: 'evaluate_curriculum',
};

/** مفاتيح الإعدادات */
export const SETTING_KEYS = {
  lotteryDefaultWinners: 'lottery_default_winners',
} as const;

export const DEFAULT_LOTTERY_WINNERS = 3;

/** حالة السحب */
export const LOTTERY_STATUS = ['draft', 'final'] as const;
export type LotteryStatus = (typeof LOTTERY_STATUS)[number];
