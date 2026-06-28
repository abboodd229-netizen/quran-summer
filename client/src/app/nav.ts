import type { Permission } from '@quran/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  perms?: Permission[]; // فارغ = متاح لكل مصادق
  adminOnly?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'اللوحة', icon: '◧', perms: ['view_dashboard'] },
  { to: '/weeks', label: 'الأسابيع', icon: '◔' },
  { to: '/circles', label: 'الحلقات', icon: '◎', perms: ['view_circle'] },
  { to: '/evaluation', label: 'التقييم', icon: '✦', perms: ['evaluate_attendance', 'evaluate_appearance', 'evaluate_behavior', 'evaluate_curriculum'] },
  { to: '/excellence', label: 'التميّز', icon: '★', perms: ['select_excellence'] },
  { to: '/lottery', label: 'السحب', icon: '◈', perms: ['run_lottery'] },
  { to: '/reports', label: 'التقارير', icon: '▤', perms: ['export_reports'] },
  { to: '/users', label: 'المستخدمون', icon: '◍', adminOnly: true },
  { to: '/activity', label: 'سجل النشاط', icon: '◷', perms: ['view_audit'] },
  { to: '/settings', label: 'الإعدادات', icon: '⚙', adminOnly: true },
];
