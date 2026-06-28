import { Router } from 'express';
import { db } from '../../db';
import { asyncHandler } from '../../middlewares/http';
import { requireAuth } from '../../middlewares/auth';
import { Errors } from '../../utils/errors';
import type { DashboardData, Week } from '@quran/shared';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const weekId = Number(req.query.week);
    const u = req.user!;
    const week = (weekId
      ? db.prepare(`SELECT id, number, label, start_date AS startDate, end_date AS endDate FROM weeks WHERE id = ?`).get(weekId)
      : db.prepare(`SELECT id, number, label, start_date AS startDate, end_date AS endDate FROM weeks ORDER BY number LIMIT 1`).get()) as
      | Week
      | undefined;
    if (!week) throw Errors.notFound('الأسبوع غير موجود');

    const scope = u.role === 'admin' ? null : u.circleIds;
    const circleFilter = scope && scope.length ? `AND c.id IN (${scope.map(() => '?').join(',')})` : scope ? 'AND 1=0' : '';
    const args = scope && scope.length ? scope : [];

    const circles = db
      .prepare(`SELECT c.id FROM circles c WHERE 1=1 ${circleFilter}`)
      .all(...args) as { id: number }[];
    const totalCircles = circles.length;

    const totalStudents = (db
      .prepare(`SELECT COUNT(*) n FROM students s JOIN circles c ON c.id = s.circle_id WHERE s.is_active = 1 ${circleFilter}`)
      .get(...args) as { n: number }).n;

    const disqualified = (db
      .prepare(
        `SELECT COUNT(*) n FROM students s
         JOIN circles c ON c.id = s.circle_id
         JOIN student_week_status st ON st.student_id = s.id AND st.week_id = ?
         WHERE s.is_active = 1 AND st.lottery_eligible = 0 ${circleFilter}`,
      )
      .get(week.id, ...args) as { n: number }).n;

    let completedCircles = 0;
    let progressSum = 0;
    for (const c of circles) {
      const total = (db.prepare(`SELECT COUNT(*) n FROM students WHERE circle_id = ? AND is_active = 1`).get(c.id) as { n: number }).n;
      const evaluated = (db
        .prepare(
          `SELECT COUNT(DISTINCT e.student_id) n FROM student_events e
           JOIN students s ON s.id = e.student_id WHERE s.circle_id = ? AND e.week_id = ?`,
        )
        .get(c.id, week.id) as { n: number }).n;
      const p = total === 0 ? 100 : Math.round((evaluated / total) * 100);
      progressSum += p;
      if (p === 100) completedCircles++;
    }
    const progress = totalCircles === 0 ? 0 : Math.round(progressSum / totalCircles);

    const data: DashboardData = {
      week,
      totalStudents,
      totalCircles,
      completedCircles,
      pendingCircles: totalCircles - completedCircles,
      eligibleStudents: totalStudents - disqualified,
      disqualifiedStudents: disqualified,
      progress,
    };
    res.json({ dashboard: data });
  }),
);

dashboardRouter.get(
  '/activity',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const items = db
      .prepare(
        `SELECT a.id, u.name AS userName, a.action, a.entity, a.created_at AS createdAt
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.id DESC LIMIT 15`,
      )
      .all();
    res.json({ activity: items });
  }),
);
