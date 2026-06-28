import { CRITERION_BLOCKS, type Criterion, type EligibilityReason } from '@quran/shared';

export interface MinimalEvent {
  criterion: Criterion;
  status: 'ok' | 'violation';
}

export interface EligibilityResult {
  lotteryEligible: boolean;
  excellenceEligible: boolean;
  reasons: EligibilityReason[];
}

/**
 * محرّك الأهلية — دالة نقيّة حتميّة.
 * مؤهل للسحب  = لا مخالفة (حضور/مظهر/سلوك)
 * مؤهل للتميّز = مؤهل للسحب و لا مخالفة منهج
 */
export function computeEligibility(events: MinimalEvent[]): EligibilityResult {
  const violated = new Set<Criterion>();
  for (const e of events) {
    if (e.status === 'violation') violated.add(e.criterion);
  }

  let lotteryEligible = true;
  let excellenceEligible = true;
  const reasons: EligibilityReason[] = [];

  for (const criterion of violated) {
    const block = CRITERION_BLOCKS[criterion];
    if (block.lottery) lotteryEligible = false;
    if (block.excellence) excellenceEligible = false;
    reasons.push({
      criterion,
      scope: block.lottery ? 'lottery_excellence' : 'excellence',
    });
  }

  // الأهلية للتميّز تتطلّب الأهلية للسحب أيضًا
  if (!lotteryEligible) excellenceEligible = false;

  return { lotteryEligible, excellenceEligible, reasons };
}
