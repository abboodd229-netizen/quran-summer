import { db } from '../index';
import { nowIso } from '../../utils/time';
import { TOTAL_WEEKS } from '@quran/shared';
import data from './data.json';

interface TrackSeed { name: string; sort_order: number; default_group_sort: number }
interface SeedData {
  tracks: TrackSeed[];
  groups: string[];
  circles: { name: string; group: number }[];
  students: { name: string; circle: string }[];
}

/** يضمن وجود المسارات والمجموعات والحلقات والأسابيع (idempotent) */
export function ensureCatalog(): void {
  const d = data as SeedData;

  // 1. مجموعات السحب
  const insGroup = db.prepare(`INSERT OR IGNORE INTO lottery_groups (name, sort_order) VALUES (?, ?)`);
  const getGroup = db.prepare(`SELECT id FROM lottery_groups WHERE name = ?`);
  const groupIds: number[] = [];
  d.groups.forEach((g, i) => {
    insGroup.run(g, i);
    groupIds[i] = (getGroup.get(g) as { id: number }).id;
  });

  // 2. المسارات التعليمية (مع ربط المجموعة الافتراضية)
  const insTrack = db.prepare(
    `INSERT OR IGNORE INTO tracks (name, sort_order, default_lottery_group_id) VALUES (?, ?, ?)`,
  );
  const getTrack = db.prepare(`SELECT id FROM tracks WHERE sort_order = ? ORDER BY id LIMIT 1`);
  const trackIds: number[] = [];
  d.tracks.forEach((t) => {
    const defaultGroupId = groupIds[t.default_group_sort] ?? null;
    insTrack.run(t.name, t.sort_order, defaultGroupId);
    trackIds[t.sort_order] = (getTrack.get(t.sort_order) as { id: number }).id;
  });

  // 3. الحلقات
  const insCircle = db.prepare(`INSERT OR IGNORE INTO circles (name, group_id, sort_order) VALUES (?, ?, ?)`);
  d.circles.forEach((c, i) => insCircle.run(c.name, groupIds[c.group], i));

  // 4. الأسابيع
  const insWeek = db.prepare(`INSERT OR IGNORE INTO weeks (number, label) VALUES (?, ?)`);
  for (let w = 1; w <= TOTAL_WEEKS; w++) insWeek.run(w, `الأسبوع ${w}`);

  // 5. ترحيل الحلقات إلى المسارات (للحلقات التي ليس لها مسار بعد)
  migrateCircleTracks(groupIds, trackIds);
}

/** ربط الحلقات الموجودة بالمسارات التعليمية (idempotent — يتجاهل الحلقات المربوطة بالفعل) */
function migrateCircleTracks(groupIds: number[], trackIds: number[]): void {
  const circles = db
    .prepare(
      `SELECT c.id, c.name, g.sort_order AS groupSort
       FROM circles c JOIN lottery_groups g ON g.id = c.group_id
       WHERE c.track_id IS NULL`,
    )
    .all() as { id: number; name: string; groupSort: number }[];

  if (circles.length === 0) return;

  const setTrack = db.prepare(`UPDATE circles SET track_id = ? WHERE id = ?`);

  for (const c of circles) {
    let trackSortOrder: number;
    if (c.groupSort === 0) trackSortOrder = 0;       // القاعدة المدنية
    else if (c.groupSort === 1) trackSortOrder = 1;  // جزأين
    else if (c.groupSort === 2) trackSortOrder = 2;  // ثلاثة أجزاء
    else if (c.groupSort === 3) trackSortOrder = 3;  // خمسة أجزاء
    else {
      // فئة "عشرة أجزاء فأكثر" — تحديد المسار من الاسم
      const n = c.name;
      if (n.includes('القرآن') || n.includes('كامل')) trackSortOrder = 8;          // القرآن كاملًا / كاملاً
      else if (n.includes('25') || n.includes('٢٥') || n.includes('وعشرين')) trackSortOrder = 7;  // 25 / خمسة وعشرين
      else if (n.includes('20') || n.includes('٢٠') || n.includes('عشرين')) trackSortOrder = 6;   // 20 / عشرين
      else if (n.includes('15') || n.includes('١٥') || n.includes('خمسة عشر')) trackSortOrder = 5; // 15
      else trackSortOrder = 4;                                                        // عشرة أجزاء (افتراضي)
    }
    const trackId = trackIds[trackSortOrder];
    if (trackId) setTrack.run(trackId, c.id);
  }
}

/** يستورد الطلاب من بيانات البذرة إن كانت قاعدة الطلاب فارغة */
export function seedStudents(): number {
  const d = data as SeedData;
  const count = (db.prepare(`SELECT COUNT(*) n FROM students`).get() as { n: number }).n;
  if (count > 0) return 0;
  const getCircle = db.prepare(`SELECT id FROM circles WHERE name = ?`);
  const ins = db.prepare(`INSERT INTO students (name, circle_id, is_active, created_at) VALUES (?, ?, 1, ?)`);
  let added = 0;
  for (const s of d.students) {
    const c = getCircle.get(s.circle) as { id: number } | undefined;
    if (c) { ins.run(s.name, c.id, nowIso()); added++; }
  }
  return added;
}
