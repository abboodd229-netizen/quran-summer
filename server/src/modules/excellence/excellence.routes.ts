import { Router } from 'express';
import { db, tx } from '../../db';
import { asyncHandler, validateBody } from '../../middlewares/http';
import { assertCircleScope, requireAuth, requirePermission } from '../../middlewares/auth';
import { selectExcellenceSchema, type ExcellenceCircleState } from '@quran/shared';
import { Errors } from '../../utils/errors';
import { writeAudit } from '../../core/audit';
import { nowIso } from '../../utils/time';
import { broadcast } from '../../core/sse';

export const excellenceRouter = Router();

/** الطلاب المؤهلون للتميّز في حلقة لأسبوع */
function eligibleForExcellence(circleId: number, weekId: number): { id: number; name: string }[] {
  return db
    .prepare(
      `SELECT s.id, s.name FROM students s
       LEFT JOIN student_week_status st ON st.student_id = s.id AND st.week_id = ?
       WHERE s.circle_id = ? AND s.is_active = 1
         AND COALESCE(st.excellence_eligible, 1) = 1
       ORDER BY s.name`,
    )
    .all(weekId, circleId) as { id: number; name: string }[];
}

function winnerOf(circleId: number, weekId: number): { id: number; name: string } | null {
  const r = db
    .prepare(
      `SELECT ew.student_id AS id, s.name FROM excellence_winners ew
       JOIN students s ON s.id = ew.student_id
       WHERE ew.week_id = ? AND ew.circle_id = ?`,
    )
    .get(weekId, circleId) as { id: number; name: string } | undefined;
  return r ?? null;
}

function circleState(circleId: number, circleName: string, weekId: number): ExcellenceCircleState {
  const eligible = eligibleForExcellence(circleId, weekId);
  const winner = winnerOf(circleId, weekId);
  let state: ExcellenceCircleState['state'];
  let winnerOut: ExcellenceCircleState['winner'] = null;
  if (winner) {
    const auto = eligible.length === 1 && eligible[0].id === winner.id;
    winnerOut = { id: winner.id, name: winner.name, auto };
    state = auto ? 'auto' : 'manual_done';
  } else if (eligible.length === 0) {
    state = 'none';
  } else if (eligible.length === 1) {
    state = 'auto';
  } else {
    state = 'manual_pending';
  }
  return { circleId, circleName, eligibleStudents: eligible, winner: winnerOut, state };
}

const upsertWinner = db.prepare(
  `INSERT INTO excellence_winners (week_id, circle_id, student_id, selected_by, selected_at)
   VALUES (@weekId, @circleId, @studentId, @by, @at)
   ON CONFLICT(week_id, circle_id) DO UPDATE SET
     student_id = @studentId, selected_by = @by, selected_at = @at`,
);

/** يضمن تسجيل المتميّز تلقائيًا حيثما يوجد مؤهل واحد */
function autoAssign(circleId: number, weekId: number, userId: number | null): void {
  const eligible = eligibleForExcellence(circleId, weekId);
  const existing = winnerOf(circleId, weekId);
  if (eligible.length === 1) {
    if (!existing || existing.id !== eligible[0].id) {
      upsertWinner.run({ weekId, circleId, studentId: eligible[0].id, by: userId, at: nowIso() });
    }
  }
}

/** حالة التميّز لكل الحلقات في أسبوع */
excellenceRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const weekId = Number(req.query.week);
    if (!weekId) throw Errors.badRequest('الأسبوع مطلوب');
    const u = req.user!;
    let circles = db.prepare(`SELECT id, name FROM circles ORDER BY sort_order`).all() as {
      id: number;
      name: string;
    }[];
    if (u.role !== 'admin') circles = circles.filter((c) => u.circleIds.includes(c.id));
    // إسناد تلقائي للحالات أحادية المؤهل
    tx(() => {
      for (const c of circles) autoAssign(c.id, weekId, u.id);
    });
    const states = circles.map((c) => circleState(c.id, c.name, weekId));
    res.json({ circles: states });
  }),
);

/** اختيار المتميّز يدويًا (عند تعدّد المؤهلين) */
excellenceRouter.post(
  '/',
  requireAuth,
  requirePermission('select_excellence'),
  validateBody(selectExcellenceSchema),
  asyncHandler(async (req, res) => {
    const { weekId, circleId, studentId } = req.body as { weekId: number; circleId: number; studentId: number };
    assertCircleScope(req, circleId);
    const eligible = eligibleForExcellence(circleId, weekId);
    if (!eligible.some((s) => s.id === studentId)) {
      throw Errors.badRequest('الطالب غير مؤهل للتميّز في هذه الحلقة');
    }
    tx(() => {
      upsertWinner.run({ weekId, circleId, studentId, by: req.user!.id, at: nowIso() });
      writeAudit({ userId: req.user!.id, action: 'select_excellence', entity: 'excellence', entityId: circleId, after: { weekId, studentId } });
    });
    broadcast('activity', { entity: 'excellence', action: 'select', by: req.user!.name, at: nowIso() });
    const c = db.prepare(`SELECT name FROM circles WHERE id = ?`).get(circleId) as { name: string };
    res.json({ state: circleState(circleId, c.name, weekId) });
  }),
);

export { eligibleForExcellence, winnerOf };
