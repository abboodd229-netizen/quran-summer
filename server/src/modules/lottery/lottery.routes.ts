import { Router } from 'express';
import { db, tx } from '../../db';
import { asyncHandler, validateBody } from '../../middlewares/http';
import { requireAdmin, requireAuth, requirePermission } from '../../middlewares/auth';
import { lotteryDrawSchema, type Lottery, type LotteryWinner } from '@quran/shared';
import { Errors } from '../../utils/errors';
import { drawWinners } from '../../core/lottery';
import { writeAudit } from '../../core/audit';
import { getLotteryDefaultWinners } from '../settings/settings.routes';
import { nowIso } from '../../utils/time';
import { broadcast } from '../../core/sse';

export const lotteryRouter = Router();

/** الطلاب المؤهلون للسحب ضمن مجموعة في أسبوع */
function eligibleInGroup(groupId: number, weekId: number): { id: number; name: string }[] {
  return db
    .prepare(
      `SELECT s.id, s.name FROM students s
       JOIN circles c ON c.id = s.circle_id
       LEFT JOIN student_week_status st ON st.student_id = s.id AND st.week_id = ?
       WHERE c.group_id = ? AND s.is_active = 1
         AND COALESCE(st.lottery_eligible, 1) = 1
       ORDER BY s.name`,
    )
    .all(weekId, groupId) as { id: number; name: string }[];
}

function loadLottery(weekId: number, groupId: number): Lottery | null {
  const l = db
    .prepare(
      `SELECT l.id, l.week_id AS weekId, l.group_id AS groupId, g.name AS groupName,
              l.winners_count AS winnersCount, l.status, l.performed_by AS performedBy, l.performed_at AS performedAt
       FROM lotteries l JOIN lottery_groups g ON g.id = l.group_id
       WHERE l.week_id = ? AND l.group_id = ?`,
    )
    .get(weekId, groupId) as Omit<Lottery, 'winners' | 'eligibleCount'> | undefined;
  if (!l) return null;
  const winners = db
    .prepare(
      `SELECT w.student_id AS studentId, s.name AS studentName, w.draw_order AS drawOrder
       FROM lottery_winners w JOIN students s ON s.id = w.student_id
       WHERE w.lottery_id = ? ORDER BY w.draw_order`,
    )
    .all(l.id) as LotteryWinner[];
  return { ...l, winners, eligibleCount: eligibleInGroup(weekId, groupId).length };
}

/** قائمة السحوبات لأسبوع (لكل مجموعة) */
lotteryRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const weekId = Number(req.query.week);
    if (!weekId) throw Errors.badRequest('الأسبوع مطلوب');
    const groups = db.prepare(`SELECT id, name FROM lottery_groups ORDER BY sort_order`).all() as {
      id: number;
      name: string;
    }[];
    const items = groups.map((g) => {
      const existing = loadLottery(weekId, g.id);
      return (
        existing ?? {
          id: 0, weekId, groupId: g.id, groupName: g.name, winnersCount: getLotteryDefaultWinners(),
          status: 'draft' as const, performedBy: null, performedAt: null, winners: [],
          eligibleCount: eligibleInGroup(g.id, weekId).length,
        }
      );
    });
    res.json({ lotteries: items, defaultWinners: getLotteryDefaultWinners() });
  }),
);

/** تنفيذ السحب (مسودّة) — النتيجة تُقرّر في الخادم */
lotteryRouter.post(
  '/draw',
  requireAuth,
  requirePermission('run_lottery'),
  validateBody(lotteryDrawSchema),
  asyncHandler(async (req, res) => {
    const { weekId, groupId } = req.body as { weekId: number; groupId: number; winnersCount?: number };
    const winnersCount = (req.body as { winnersCount?: number }).winnersCount ?? getLotteryDefaultWinners();

    const existingFinal = db
      .prepare(`SELECT status FROM lotteries WHERE week_id = ? AND group_id = ?`)
      .get(weekId, groupId) as { status: string } | undefined;
    if (existingFinal?.status === 'final') throw Errors.conflict('تم اعتماد سحب هذه المجموعة ولا يمكن تعديله');

    const pool = eligibleInGroup(groupId, weekId);
    if (pool.length === 0) throw Errors.badRequest('لا يوجد طلاب مؤهلون في هذه المجموعة');
    const winners = drawWinners(pool, winnersCount);

    const result = tx(() => {
      let lotteryId: number;
      const ex = db.prepare(`SELECT id FROM lotteries WHERE week_id = ? AND group_id = ?`).get(weekId, groupId) as
        | { id: number }
        | undefined;
      if (ex) {
        lotteryId = ex.id;
        db.prepare(`UPDATE lotteries SET winners_count = ?, status = 'draft', performed_by = ?, performed_at = ? WHERE id = ?`)
          .run(winnersCount, req.user!.id, nowIso(), lotteryId);
        db.prepare(`DELETE FROM lottery_winners WHERE lottery_id = ?`).run(lotteryId);
      } else {
        const r = db
          .prepare(
            `INSERT INTO lotteries (week_id, group_id, winners_count, status, performed_by, performed_at)
             VALUES (?, ?, ?, 'draft', ?, ?)`,
          )
          .run(weekId, groupId, winnersCount, req.user!.id, nowIso());
        lotteryId = Number(r.lastInsertRowid);
      }
      const insW = db.prepare(`INSERT INTO lottery_winners (lottery_id, student_id, draw_order) VALUES (?, ?, ?)`);
      winners.forEach((w, i) => insW.run(lotteryId, w.id, i + 1));
      writeAudit({
        userId: req.user!.id, action: 'draw', entity: 'lottery', entityId: lotteryId,
        after: { weekId, groupId, winnersCount, winners: winners.map((w) => w.id) },
      });
      return loadLottery(weekId, groupId)!;
    });

    broadcast('lottery_draw', result);
    res.json({ lottery: result });
  }),
);

/** اعتماد السحب نهائيًا */
lotteryRouter.post(
  '/:id/finalize',
  requireAuth,
  requirePermission('run_lottery'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const l = db.prepare(`SELECT id, week_id AS weekId, group_id AS groupId, status FROM lotteries WHERE id = ?`).get(id) as
      | { id: number; weekId: number; groupId: number; status: string }
      | undefined;
    if (!l) throw Errors.notFound('السحب غير موجود');
    if (l.status === 'final') throw Errors.conflict('سبق اعتماد هذا السحب');
    const result = tx(() => {
      db.prepare(`UPDATE lotteries SET status = 'final' WHERE id = ?`).run(id);
      writeAudit({ userId: req.user!.id, action: 'finalize', entity: 'lottery', entityId: id });
      return loadLottery(l.weekId, l.groupId)!;
    });
    broadcast('lottery_final', result);
    res.json({ lottery: result });
  }),
);

/** إلغاء اعتماد سحب نهائي (مدير فقط) — يحذف النتائج ويعيد الحالة إلى مسودّة */
lotteryRouter.post(
  '/:id/undo',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const l = db.prepare(`SELECT id, week_id AS weekId, group_id AS groupId, status FROM lotteries WHERE id = ?`).get(id) as
      | { id: number; weekId: number; groupId: number; status: string }
      | undefined;
    if (!l) throw Errors.notFound('السحب غير موجود');
    if (l.status !== 'final') throw Errors.conflict('لا يمكن التراجع عن سحب غير معتمد');
    const result = tx(() => {
      db.prepare(`DELETE FROM lottery_winners WHERE lottery_id = ?`).run(id);
      db.prepare(`UPDATE lotteries SET status = 'draft', performed_by = NULL, performed_at = NULL WHERE id = ?`).run(id);
      writeAudit({ userId: req.user!.id, action: 'undo', entity: 'lottery', entityId: id, before: { status: 'final' } });
      return loadLottery(l.weekId, l.groupId)!;
    });
    broadcast('lottery_undo', result);
    res.json({ lottery: result });
  }),
);
