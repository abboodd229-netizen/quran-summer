import { CRITERION_LABELS, type Criterion } from '@quran/shared';
import type { StudentStatus } from '@quran/shared';

interface Props {
  status: StudentStatus | undefined;
  /** Show the disqualification reason inline (default: true) */
  showReason?: boolean;
}

/**
 * Unified status indicator used across list views.
 * 🟢 Eligible (lottery + excellence)
 * 🟡 Lottery-eligible only (curriculum violation)
 * ⚪ Disqualified (attendance / appearance / behaviour violation)
 */
export function StudentStatusBadge({ status, showReason = true }: Props) {
  if (!status) {
    return <span className="text-xs text-muted">—</span>;
  }

  const reasonText = status.reasons
    .map((r) => CRITERION_LABELS[r.criterion as Criterion])
    .join('، ');

  if (!status.lotteryEligible) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1 text-sm leading-snug">
        <span aria-label="مستبعد">⚪</span>
        <span className="font-medium text-muted">مستبعد</span>
        {showReason && reasonText && (
          <span className="text-xs text-danger">— {reasonText}</span>
        )}
      </span>
    );
  }

  if (!status.excellenceEligible) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1 text-sm leading-snug">
        <span aria-label="مؤهل للسحب">🟡</span>
        <span className="font-medium text-warn">مؤهل للسحب</span>
        {showReason && reasonText && (
          <span className="text-xs text-warn">— {reasonText}</span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm leading-snug">
      <span aria-label="مؤهل">🟢</span>
      <span className="font-medium text-brand-700">مؤهل</span>
    </span>
  );
}
