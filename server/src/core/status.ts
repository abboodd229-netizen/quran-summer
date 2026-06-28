import { db } from '../db';
import { nowIso } from '../utils/time';
import { computeEligibility, type MinimalEvent } from './eligibility';
import type { StudentStatus } from '@quran/shared';

const selEvents = db.prepare(
  `SELECT criterion, status FROM student_events WHERE student_id = ? AND week_id = ?`,
);
const upsertStatus = db.prepare(
  `INSERT INTO student_week_status (student_id, week_id, lottery_eligible, excellence_eligible, reasons, updated_at)
   VALUES (@studentId, @weekId, @lottery, @excellence, @reasons, @updatedAt)
   ON CONFLICT(student_id, week_id) DO UPDATE SET
     lottery_eligible = @lottery,
     excellence_eligible = @excellence,
     reasons = @reasons,
     updated_at = @updatedAt`,
);

/** يعيد حساب أهلية الطالب لأسبوع ويحفظها (يُستدعى داخل المعاملة) */
export function recomputeStudentWeek(studentId: number, weekId: number): StudentStatus {
  const events = selEvents.all(studentId, weekId) as MinimalEvent[];
  const r = computeEligibility(events);
  upsertStatus.run({
    studentId,
    weekId,
    lottery: r.lotteryEligible ? 1 : 0,
    excellence: r.excellenceEligible ? 1 : 0,
    reasons: JSON.stringify(r.reasons),
    updatedAt: nowIso(),
  });
  return {
    studentId,
    weekId,
    lotteryEligible: r.lotteryEligible,
    excellenceEligible: r.excellenceEligible,
    reasons: r.reasons,
  };
}

const selStatus = db.prepare(
  `SELECT lottery_eligible, excellence_eligible, reasons FROM student_week_status
   WHERE student_id = ? AND week_id = ?`,
);

/** يقرأ حالة الطالب لأسبوع (يحسبها افتراضيًا مؤهلًا إن لم تُسجّل بعد) */
export function getStudentStatus(studentId: number, weekId: number): StudentStatus {
  const row = selStatus.get(studentId, weekId) as
    | { lottery_eligible: number; excellence_eligible: number; reasons: string }
    | undefined;
  if (!row) {
    return { studentId, weekId, lotteryEligible: true, excellenceEligible: true, reasons: [] };
  }
  return {
    studentId,
    weekId,
    lotteryEligible: !!row.lottery_eligible,
    excellenceEligible: !!row.excellence_eligible,
    reasons: JSON.parse(row.reasons),
  };
}
