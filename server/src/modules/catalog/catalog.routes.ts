import { Router } from 'express';
import { db, tx } from '../../db';
import { asyncHandler } from '../../middlewares/http';
import { assertCircleScope, requireAdmin, requireAuth } from '../../middlewares/auth';
import { Errors } from '../../utils/errors';
import { writeAudit } from '../../core/audit';
import type { Circle, Group, Track, Week } from '@quran/shared';

export const catalogRouter = Router();

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

function nextCircleName(trackId: number): string {
  const track = db.prepare(`SELECT name FROM tracks WHERE id = ?`).get(trackId) as { name: string } | undefined;
  if (!track) return 'حلقة جديدة';
  const prefix = CIRCLE_PREFIXES[track.name] ?? `حلقة ${track.name}`;
  const count = (db.prepare(`SELECT COUNT(*) n FROM circles WHERE track_id = ?`).get(trackId) as { n: number }).n;
  return `${prefix} (${count + 1})`;
}

catalogRouter.get(
  '/weeks',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const weeks = db
      .prepare(`SELECT id, number, label, start_date AS startDate, end_date AS endDate, is_locked AS isLocked FROM weeks ORDER BY number`)
      .all()
      .map((w: unknown) => ({ ...(w as object), isLocked: Boolean((w as Record<string, unknown>).isLocked) })) as Week[];
    res.json({ weeks });
  }),
);

/** قفل/فتح أسبوع (مدير فقط) */
catalogRouter.patch(
  '/weeks/:id/lock',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare(`SELECT id, is_locked AS isLocked FROM weeks WHERE id = ?`).get(id) as
      | { id: number; isLocked: number }
      | undefined;
    if (!row) throw Errors.notFound('الأسبوع غير موجود');
    const newLocked = row.isLocked ? 0 : 1;
    tx(() => {
      db.prepare(`UPDATE weeks SET is_locked = ? WHERE id = ?`).run(newLocked, id);
      writeAudit({ userId: req.user!.id, action: newLocked ? 'lock' : 'unlock', entity: 'week', entityId: id });
    });
    res.json({ id, isLocked: Boolean(newLocked) });
  }),
);

catalogRouter.get(
  '/groups',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const groups = db
      .prepare(`SELECT id, name, sort_order AS sortOrder FROM lottery_groups ORDER BY sort_order`)
      .all() as Group[];
    res.json({ groups });
  }),
);

catalogRouter.get(
  '/tracks',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const tracks = db
      .prepare(
        `SELECT id, name, sort_order AS sortOrder, default_lottery_group_id AS defaultLotteryGroupId
         FROM tracks ORDER BY sort_order`,
      )
      .all() as Track[];
    res.json({ tracks });
  }),
);

/** قائمة الحلقات مع إحصاء الأسبوع */
catalogRouter.get(
  '/circles',
  requireAuth,
  asyncHandler(async (req, res) => {
    const weekId = Number(req.query.week);
    const u = req.user!;
    let rows = db
      .prepare(
        `SELECT c.id, c.name, c.group_id AS groupId, g.name AS groupName,
                c.track_id AS trackId, t.name AS trackName, c.sort_order AS sortOrder
         FROM circles c
         JOIN lottery_groups g ON g.id = c.group_id
         LEFT JOIN tracks t ON t.id = c.track_id
         ORDER BY g.sort_order, c.sort_order`,
      )
      .all() as Circle[];
    if (u.role !== 'admin') rows = rows.filter((c) => u.circleIds.includes(c.id));

    const stats = rows.map((c) => {
      const counts = circleCounts(c.id, weekId);
      return { ...c, ...counts };
    });
    res.json({ circles: stats });
  }),
);

/** تفاصيل حلقة */
catalogRouter.get(
  '/circles/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const weekId = Number(req.query.week);
    assertCircleScope(req, id);
    const c = db
      .prepare(
        `SELECT c.id, c.name, c.group_id AS groupId, g.name AS groupName,
                c.track_id AS trackId, t.name AS trackName, c.sort_order AS sortOrder
         FROM circles c
         JOIN lottery_groups g ON g.id = c.group_id
         LEFT JOIN tracks t ON t.id = c.track_id
         WHERE c.id = ?`,
      )
      .get(id) as Circle | undefined;
    if (!c) throw Errors.notFound('الحلقة غير موجودة');
    res.json({ circle: { ...c, ...circleCounts(id, weekId) } });
  }),
);

/** إحصاء حلقة لأسبوع: العدد، المؤهلون، المستبعدون، نسبة الإكمال */
export function circleCounts(circleId: number, weekId: number) {
  const total = (db.prepare(`SELECT COUNT(*) n FROM students WHERE circle_id = ? AND is_active = 1`).get(circleId) as { n: number }).n;
  if (!weekId || total === 0) {
    return { studentCount: total, eligibleCount: total, disqualifiedCount: 0, progress: total === 0 ? 100 : 0, completed: total === 0 };
  }
  const disq = (db
    .prepare(
      `SELECT COUNT(*) n FROM students s
       JOIN student_week_status st ON st.student_id = s.id AND st.week_id = ?
       WHERE s.circle_id = ? AND s.is_active = 1 AND st.lottery_eligible = 0`,
    )
    .get(weekId, circleId) as { n: number }).n;
  // التقدّم: نسبة الطلاب الذين أُدخلت لهم بيانات هذا الأسبوع (أي حدث)
  const evaluated = (db
    .prepare(
      `SELECT COUNT(DISTINCT e.student_id) n FROM student_events e
       JOIN students s ON s.id = e.student_id
       WHERE s.circle_id = ? AND e.week_id = ?`,
    )
    .get(circleId, weekId) as { n: number }).n;
  const progress = total === 0 ? 100 : Math.round((evaluated / total) * 100);
  return {
    studentCount: total,
    eligibleCount: total - disq,
    disqualifiedCount: disq,
    progress,
    completed: progress === 100,
  };
}

// ─── إدارة الحلقات (مدير فقط) ─────────────────────────────────────────────

/** إنشاء حلقة جديدة — الاسم يُولَّد تلقائيًا من المسار التعليمي */
catalogRouter.post(
  '/circles',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { groupId, trackId } = req.body as { groupId: number; trackId: number };
    if (!trackId) throw Errors.badRequest('المسار التعليمي مطلوب');
    const group = db.prepare(`SELECT id FROM lottery_groups WHERE id = ?`).get(groupId);
    if (!group) throw Errors.notFound('المجموعة غير موجودة');
    const t = db.prepare(`SELECT id FROM tracks WHERE id = ?`).get(trackId);
    if (!t) throw Errors.notFound('المسار غير موجود');
    const name = nextCircleName(trackId);
    const id = tx(() => {
      const r = db.prepare(
        `INSERT INTO circles (name, group_id, track_id, sort_order)
         VALUES (?, ?, ?, COALESCE((SELECT MAX(sort_order)+1 FROM circles WHERE group_id = ?), 0))`,
      ).run(name, groupId, trackId, groupId);
      const newId = Number(r.lastInsertRowid);
      writeAudit({ userId: req.user!.id, action: 'create', entity: 'circle', entityId: newId, after: { name, groupId, trackId } });
      return newId;
    });
    res.status(201).json({ id, name, groupId, trackId });
  }),
);

/** تعديل اسم أو مجموعة أو مسار حلقة */
catalogRouter.patch(
  '/circles/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const c = db.prepare(`SELECT id, name, group_id AS groupId, track_id AS trackId FROM circles WHERE id = ?`).get(id) as
      | { id: number; name: string; groupId: number; trackId: number | null }
      | undefined;
    if (!c) throw Errors.notFound('الحلقة غير موجودة');
    const { name, groupId, trackId } = req.body as { name?: string; groupId?: number; trackId?: number | null };
    const newName = name?.trim() ?? c.name;
    const newGroupId = groupId ?? c.groupId;
    const newTrackId = trackId !== undefined ? (trackId ?? null) : c.trackId;
    if (groupId) {
      const g = db.prepare(`SELECT id FROM lottery_groups WHERE id = ?`).get(newGroupId);
      if (!g) throw Errors.notFound('المجموعة غير موجودة');
    }
    if (newTrackId) {
      const t = db.prepare(`SELECT id FROM tracks WHERE id = ?`).get(newTrackId);
      if (!t) throw Errors.notFound('المسار غير موجود');
    }
    tx(() => {
      db.prepare(`UPDATE circles SET name = ?, group_id = ?, track_id = ? WHERE id = ?`).run(newName, newGroupId, newTrackId, id);
      writeAudit({ userId: req.user!.id, action: 'update', entity: 'circle', entityId: id, before: { name: c.name, groupId: c.groupId, trackId: c.trackId }, after: { name: newName, groupId: newGroupId, trackId: newTrackId } });
    });
    res.json({ ok: true });
  }),
);

/** حذف حلقة (فارغة فقط) */
catalogRouter.delete(
  '/circles/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const c = db.prepare(`SELECT id FROM circles WHERE id = ?`).get(id);
    if (!c) throw Errors.notFound('الحلقة غير موجودة');
    const count = (db.prepare(`SELECT COUNT(*) n FROM students WHERE circle_id = ? AND is_active = 1`).get(id) as { n: number }).n;
    if (count > 0) throw Errors.conflict('لا يمكن حذف حلقة تحتوي على طلاب — انقل الطلاب أولًا');
    tx(() => {
      db.prepare(`DELETE FROM circles WHERE id = ?`).run(id);
      writeAudit({ userId: req.user!.id, action: 'delete', entity: 'circle', entityId: id });
    });
    res.json({ ok: true });
  }),
);

/** استنساخ حلقة (نسخة جديدة فارغة في نفس المجموعة والمسار) */
catalogRouter.post(
  '/circles/:id/clone',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const c = db.prepare(`SELECT id, name, group_id AS groupId, track_id AS trackId FROM circles WHERE id = ?`).get(id) as
      | { id: number; name: string; groupId: number; trackId: number | null }
      | undefined;
    if (!c) throw Errors.notFound('الحلقة غير موجودة');
    const newName = c.trackId ? nextCircleName(c.trackId) : `${c.name} (نسخة)`;
    const newId = tx(() => {
      const r = db.prepare(
        `INSERT INTO circles (name, group_id, track_id, sort_order)
         VALUES (?, ?, ?, COALESCE((SELECT MAX(sort_order)+1 FROM circles WHERE group_id = ?), 0))`,
      ).run(newName, c.groupId, c.trackId, c.groupId);
      const createdId = Number(r.lastInsertRowid);
      writeAudit({ userId: req.user!.id, action: 'clone', entity: 'circle', entityId: id, after: { fromId: id, newId: createdId, name: newName } });
      return createdId;
    });
    res.status(201).json({ id: newId, name: newName });
  }),
);

/** نقل جميع طلاب حلقة إلى حلقة أخرى */
catalogRouter.post(
  '/circles/:id/move-students',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const fromId = Number(req.params.id);
    const { targetCircleId } = req.body as { targetCircleId: number };
    if (!targetCircleId) throw Errors.badRequest('الحلقة الهدف مطلوبة');
    if (fromId === targetCircleId) throw Errors.badRequest('الحلقة الهدف هي نفس الحلقة المصدر');
    const target = db.prepare(`SELECT id FROM circles WHERE id = ?`).get(targetCircleId);
    if (!target) throw Errors.notFound('الحلقة الهدف غير موجودة');
    const moved = tx(() => {
      const r = db.prepare(`UPDATE students SET circle_id = ? WHERE circle_id = ? AND is_active = 1`).run(targetCircleId, fromId);
      writeAudit({ userId: req.user!.id, action: 'move_students', entity: 'circle', entityId: fromId, after: { targetCircleId, count: r.changes } });
      return r.changes;
    });
    res.json({ ok: true, moved });
  }),
);
