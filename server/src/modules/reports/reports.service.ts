import { db } from '../../db';
import { CRITERION_LABELS, type Criterion } from '@quran/shared';
import { Errors } from '../../utils/errors';

export interface WeeklyReport {
  week: { id: number; number: number; label: string };
  stats: { totalStudents: number; eligible: number; disqualified: number; excellenceDecided: number; totalCircles: number };
  lottery: { groupName: string; status: string; winnersCount: number; winners: string[]; eligibleCount: number }[];
  excellence: { circleName: string; winner: string | null; state: string }[];
  disqualified: { name: string; circleName: string; reasons: string[] }[];
}

const reasonLabel = (c: Criterion) => CRITERION_LABELS[c];

export function buildWeeklyReport(weekId: number): WeeklyReport {
  const week = db.prepare(`SELECT id, number, label FROM weeks WHERE id = ?`).get(weekId) as
    | { id: number; number: number; label: string }
    | undefined;
  if (!week) throw Errors.notFound('الأسبوع غير موجود');

  const totalStudents = (db.prepare(`SELECT COUNT(*) n FROM students WHERE is_active = 1`).get() as { n: number }).n;
  const totalCircles = (db.prepare(`SELECT COUNT(*) n FROM circles`).get() as { n: number }).n;
  const disqualifiedRows = db
    .prepare(
      `SELECT s.name, c.name AS circleName, st.reasons
       FROM students s JOIN circles c ON c.id = s.circle_id
       JOIN student_week_status st ON st.student_id = s.id AND st.week_id = ?
       WHERE s.is_active = 1 AND st.lottery_eligible = 0
       ORDER BY c.sort_order, s.name`,
    )
    .all(weekId) as { name: string; circleName: string; reasons: string }[];
  const disqualified = disqualifiedRows.map((r) => ({
    name: r.name,
    circleName: r.circleName,
    reasons: (JSON.parse(r.reasons) as { criterion: Criterion }[]).map((x) => reasonLabel(x.criterion)),
  }));

  const groups = db.prepare(`SELECT id, name FROM lottery_groups ORDER BY sort_order`).all() as {
    id: number;
    name: string;
  }[];
  const lottery = groups.map((g) => {
    const l = db
      .prepare(`SELECT id, winners_count AS wc, status FROM lotteries WHERE week_id = ? AND group_id = ?`)
      .get(weekId, g.id) as { id: number; wc: number; status: string } | undefined;
    const winners = l
      ? (db
          .prepare(
            `SELECT s.name FROM lottery_winners w JOIN students s ON s.id = w.student_id
             WHERE w.lottery_id = ? ORDER BY w.draw_order`,
          )
          .all(l.id) as { name: string }[]).map((x) => x.name)
      : [];
    const eligibleCount = (db
      .prepare(
        `SELECT COUNT(*) n FROM students s JOIN circles c ON c.id = s.circle_id
         LEFT JOIN student_week_status st ON st.student_id = s.id AND st.week_id = ?
         WHERE c.group_id = ? AND s.is_active = 1 AND COALESCE(st.lottery_eligible,1) = 1`,
      )
      .get(weekId, g.id) as { n: number }).n;
    return { groupName: g.name, status: l?.status ?? 'لم يُجرَ', winnersCount: l?.wc ?? 0, winners, eligibleCount };
  });

  const circles = db.prepare(`SELECT id, name FROM circles ORDER BY sort_order`).all() as {
    id: number;
    name: string;
  }[];
  const excellence = circles.map((c) => {
    const w = db
      .prepare(
        `SELECT s.name FROM excellence_winners ew JOIN students s ON s.id = ew.student_id
         WHERE ew.week_id = ? AND ew.circle_id = ?`,
      )
      .get(weekId, c.id) as { name: string } | undefined;
    const eligibleCount = (db
      .prepare(
        `SELECT COUNT(*) n FROM students s
         LEFT JOIN student_week_status st ON st.student_id = s.id AND st.week_id = ?
         WHERE s.circle_id = ? AND s.is_active = 1 AND COALESCE(st.excellence_eligible,1) = 1`,
      )
      .get(weekId, c.id) as { n: number }).n;
    const state = w ? 'محسوم' : eligibleCount === 0 ? 'لا مؤهل' : 'بانتظار الحسم';
    return { circleName: c.name, winner: w?.name ?? null, state };
  });

  const excellenceDecided = excellence.filter((e) => e.winner).length;

  return {
    week,
    stats: {
      totalStudents,
      eligible: totalStudents - disqualified.length,
      disqualified: disqualified.length,
      excellenceDecided,
      totalCircles,
    },
    lottery,
    excellence,
    disqualified,
  };
}
