import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { db, tx } from '../../db';
import { asyncHandler, validateBody } from '../../middlewares/http';
import { assertCircleScope, requireAuth, requirePermission } from '../../middlewares/auth';
import { createStudentSchema, moveStudentSchema } from '@quran/shared';
import type { Student, StudentEvent, TimelineItem } from '@quran/shared';
import { CRITERION_LABELS, EVENT_STATUS, WEEK_DAY_LABELS } from '@quran/shared';
import { Errors } from '../../utils/errors';
import { writeAudit } from '../../core/audit';
import { getStudentStatus } from '../../core/status';
import { nowIso } from '../../utils/time';
import { broadcast } from '../../core/sse';

export const studentsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/** طلاب حلقة مع حالتهم في أسبوع */
studentsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const circleId = Number(req.query.circle);
    const weekId = Number(req.query.week);
    if (!circleId) throw Errors.badRequest('معرّف الحلقة مطلوب');
    assertCircleScope(req, circleId);
    const students = db
      .prepare(
        `SELECT s.id, s.name, s.circle_id AS circleId, s.is_active AS isActive
         FROM students s WHERE s.circle_id = ? AND s.is_active = 1 ORDER BY s.name`,
      )
      .all(circleId) as Student[];
    const withStatus = students.map((s) => ({
      ...s,
      isActive: !!(s as unknown as { isActive: number }).isActive,
      status: weekId ? getStudentStatus(s.id, weekId) : undefined,
    }));
    res.json({ students: withStatus });
  }),
);

/** المخطط الزمني للطالب */
studentsRouter.get(
  '/:id/timeline',
  requireAuth,
  requirePermission('view_student_timeline'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const weekId = req.query.week ? Number(req.query.week) : null;
    const student = db
      .prepare(
        `SELECT s.id, s.name, s.circle_id AS circleId, c.name AS circleName
         FROM students s JOIN circles c ON c.id = s.circle_id WHERE s.id = ?`,
      )
      .get(id) as (Student & { circleName: string }) | undefined;
    if (!student) throw Errors.notFound('الطالب غير موجود');
    assertCircleScope(req, student.circleId);

    const evWhere = weekId ? `AND e.week_id = ?` : '';
    const evArgs = weekId ? [id, weekId] : [id];
    const events = db
      .prepare(
        `SELECT e.id, e.criterion, e.status, e.day_date AS dayDate, e.note, e.created_at AS createdAt,
                u.name AS createdByName
         FROM student_events e LEFT JOIN users u ON u.id = e.created_by
         WHERE e.student_id = ? ${evWhere} ORDER BY e.created_at DESC`,
      )
      .all(...evArgs) as (StudentEvent & { createdByName: string | null })[];

    const items: TimelineItem[] = events.map((e) => ({
      kind: 'event',
      id: e.id,
      at: e.createdAt,
      title: `${CRITERION_LABELS[e.criterion]} — ${e.status === 'violation' ? 'مخالفة' : 'سليم'}${e.dayDate ? ` (${WEEK_DAY_LABELS[e.dayDate]})` : ''}`,
      detail: e.note ?? undefined,
      by: e.createdByName ?? undefined,
    }));

    const status = weekId ? getStudentStatus(id, weekId) : undefined;
    res.json({ student: { ...student, status }, timeline: items });
  }),
);

/** إضافة طالب */
studentsRouter.post(
  '/',
  requireAuth,
  requirePermission('manage_students'),
  validateBody(createStudentSchema),
  asyncHandler(async (req, res) => {
    const { name, circleId } = req.body as { name: string; circleId: number };
    assertCircleScope(req, circleId);
    const circle = db.prepare(`SELECT id FROM circles WHERE id = ?`).get(circleId);
    if (!circle) throw Errors.badRequest('الحلقة غير موجودة');
    const info = tx(() => {
      const r = db
        .prepare(`INSERT INTO students (name, circle_id, is_active, created_at) VALUES (?, ?, 1, ?)`)
        .run(name, circleId, nowIso());
      writeAudit({ userId: req.user!.id, action: 'create', entity: 'student', entityId: Number(r.lastInsertRowid), after: { name, circleId } });
      return r;
    });
    broadcast('activity', { entity: 'student', action: 'create', by: req.user!.name, at: nowIso() });
    res.status(201).json({ id: info.lastInsertRowid });
  }),
);

/** نقل طالب بين الحلقات */
studentsRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('manage_students'),
  validateBody(moveStudentSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { circleId } = req.body as { circleId: number };
    const student = db.prepare(`SELECT id, circle_id AS circleId FROM students WHERE id = ?`).get(id) as
      | { id: number; circleId: number }
      | undefined;
    if (!student) throw Errors.notFound('الطالب غير موجود');
    assertCircleScope(req, student.circleId);
    assertCircleScope(req, circleId);
    tx(() => {
      db.prepare(`UPDATE students SET circle_id = ? WHERE id = ?`).run(circleId, id);
      writeAudit({
        userId: req.user!.id, action: 'move', entity: 'student', entityId: id,
        before: { circleId: student.circleId }, after: { circleId },
      });
    });
    broadcast('activity', { entity: 'student', action: 'move', by: req.user!.name, at: nowIso() });
    res.json({ ok: true });
  }),
);

/** حذف طالب (تعطيل ناعم للحفاظ على السجل) */
studentsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('manage_students'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const student = db.prepare(`SELECT id, name, circle_id AS circleId FROM students WHERE id = ?`).get(id) as
      | { id: number; name: string; circleId: number }
      | undefined;
    if (!student) throw Errors.notFound('الطالب غير موجود');
    assertCircleScope(req, student.circleId);
    tx(() => {
      db.prepare(`UPDATE students SET is_active = 0 WHERE id = ?`).run(id);
      writeAudit({ userId: req.user!.id, action: 'delete', entity: 'student', entityId: id, before: student });
    });
    res.json({ ok: true });
  }),
);

/** استيراد من Excel (عمودان: الاسم، الحلقة) */
studentsRouter.post(
  '/import',
  requireAuth,
  requirePermission('manage_students'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'admin') throw Errors.forbidden('الاستيراد متاح للمدير');
    if (!req.file) throw Errors.badRequest('لم يُرفع ملف');
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

    const circles = db.prepare(`SELECT id, name FROM circles`).all() as { id: number; name: string }[];
    const byName = new Map(circles.map((c) => [c.name.trim(), c.id]));

    let added = 0;
    const unmatched: string[] = [];
    tx(() => {
      for (let i = 1; i < rows.length; i++) {
        const name = String(rows[i]?.[0] ?? '').trim();
        const circleName = String(rows[i]?.[1] ?? '').trim();
        if (!name || !circleName) continue;
        const circleId = byName.get(circleName);
        if (!circleId) {
          if (!unmatched.includes(circleName)) unmatched.push(circleName);
          continue;
        }
        const exists = db
          .prepare(`SELECT id FROM students WHERE name = ? AND circle_id = ? AND is_active = 1`)
          .get(name, circleId);
        if (exists) continue;
        db.prepare(`INSERT INTO students (name, circle_id, is_active, created_at) VALUES (?, ?, 1, ?)`)
          .run(name, circleId, nowIso());
        added++;
      }
      writeAudit({ userId: req.user!.id, action: 'import', entity: 'student', after: { added, unmatched } });
    });
    res.json({ added, unmatched });
  }),
);

export { EVENT_STATUS };
