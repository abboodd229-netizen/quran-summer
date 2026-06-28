import { Router } from 'express';
import { z } from 'zod';
import { db, tx } from '../../db';
import { asyncHandler, validateBody } from '../../middlewares/http';
import { assertCircleScope, requireAuth, requirePermission } from '../../middlewares/auth';
import { CRITERION_PERMISSION, DAILY_CRITERIA, upsertEventSchema, type Criterion } from '@quran/shared';
import { Errors } from '../../utils/errors';
import { writeAudit } from '../../core/audit';
import { recomputeStudentWeek } from '../../core/status';
import { nowIso } from '../../utils/time';
import { broadcast } from '../../core/sse';

export const eventsRouter = Router();

const clearSchema = z.object({
  studentId: z.number().int().positive(),
  weekId: z.number().int().positive(),
  criterion: z.enum(['attendance', 'appearance', 'behavior', 'curriculum']),
  dayDate: z.string().nullable().optional(),
});

function circleOfStudent(studentId: number): number {
  const r = db.prepare(`SELECT circle_id AS c FROM students WHERE id = ? AND is_active = 1`).get(studentId) as
    | { c: number }
    | undefined;
  if (!r) throw Errors.notFound('الطالب غير موجود');
  return r.c;
}

function assertWeekNotLocked(weekId: number, isAdmin: boolean): void {
  if (isAdmin) return;
  const w = db.prepare(`SELECT is_locked FROM weeks WHERE id = ?`).get(weekId) as { is_locked: number } | undefined;
  if (w?.is_locked) throw Errors.forbidden('الأسبوع مقفل — لا يمكن تعديل التقييم');
}

function ensureDayConsistency(criterion: Criterion, dayDate: string | null | undefined): string | null {
  const isDaily = DAILY_CRITERIA.includes(criterion);
  if (isDaily && !dayDate) throw Errors.badRequest('اليوم مطلوب للمعايير اليومية');
  if (!isDaily) return null;
  return dayDate ?? null;
}

const findCell = db.prepare(
  `SELECT id FROM student_events
   WHERE student_id = ? AND week_id = ? AND criterion = ?
     AND ((day_date IS NULL AND ? IS NULL) OR day_date = ?)`,
);

/** شبكة أحداث حلقة لأسبوع */
eventsRouter.get(
  '/grid',
  requireAuth,
  asyncHandler(async (req, res) => {
    const circleId = Number(req.query.circle);
    const weekId = Number(req.query.week);
    if (!circleId || !weekId) throw Errors.badRequest('الحلقة والأسبوع مطلوبان');
    assertCircleScope(req, circleId);
    const events = db
      .prepare(
        `SELECT e.id, e.student_id AS studentId, e.criterion, e.status, e.day_date AS dayDate, e.note
         FROM student_events e JOIN students s ON s.id = e.student_id
         WHERE s.circle_id = ? AND e.week_id = ?`,
      )
      .all(circleId, weekId);
    res.json({ events });
  }),
);

/** إنشاء/تحديث خلية تقييم (حفظ تلقائي) */
eventsRouter.post(
  '/',
  requireAuth,
  validateBody(upsertEventSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof upsertEventSchema>;
    const circleId = circleOfStudent(body.studentId);
    assertCircleScope(req, circleId);
    assertWeekNotLocked(body.weekId, req.user!.role === 'admin');
    // صلاحية تقييم هذا المعيار
    requirePermission(CRITERION_PERMISSION[body.criterion])(req, res, () => {});

    const day = ensureDayConsistency(body.criterion, body.dayDate ?? null);
    const status = tx(() => {
      const existing = findCell.get(body.studentId, body.weekId, body.criterion, day, day) as
        | { id: number }
        | undefined;
      if (existing) {
        db.prepare(`UPDATE student_events SET status = ?, note = ?, created_by = ?, created_at = ? WHERE id = ?`)
          .run(body.status, body.note ?? null, req.user!.id, nowIso(), existing.id);
      } else {
        db.prepare(
          `INSERT INTO student_events (student_id, week_id, criterion, status, day_date, note, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(body.studentId, body.weekId, body.criterion, body.status, day, body.note ?? null, req.user!.id, nowIso());
      }
      writeAudit({
        userId: req.user!.id, action: 'evaluate', entity: 'student_event',
        entityId: body.studentId, after: { criterion: body.criterion, status: body.status, dayDate: day },
      });
      return recomputeStudentWeek(body.studentId, body.weekId);
    });
    broadcast('activity', { entity: 'evaluation', action: body.criterion, by: req.user!.name, at: nowIso() });
    broadcast('status', { studentId: body.studentId, weekId: body.weekId, status });
    res.json({ status });
  }),
);

/** مسح خلية تقييم */
eventsRouter.post(
  '/clear',
  requireAuth,
  validateBody(clearSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof clearSchema>;
    const circleId = circleOfStudent(body.studentId);
    assertCircleScope(req, circleId);
    assertWeekNotLocked(body.weekId, req.user!.role === 'admin');
    requirePermission(CRITERION_PERMISSION[body.criterion as Criterion])(req, res, () => {});
    const day = body.dayDate ?? null;
    const status = tx(() => {
      const existing = findCell.get(body.studentId, body.weekId, body.criterion, day, day) as
        | { id: number }
        | undefined;
      if (existing) {
        db.prepare(`DELETE FROM student_events WHERE id = ?`).run(existing.id);
        writeAudit({
          userId: req.user!.id, action: 'clear', entity: 'student_event', entityId: body.studentId,
          before: { criterion: body.criterion, dayDate: day },
        });
      }
      return recomputeStudentWeek(body.studentId, body.weekId);
    });
    broadcast('status', { studentId: body.studentId, weekId: body.weekId, status });
    res.json({ status });
  }),
);
