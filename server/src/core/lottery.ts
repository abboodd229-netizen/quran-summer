import { randomInt } from 'node:crypto';

/**
 * خلط Fisher–Yates ببذرة تشفيرية (crypto.randomInt) — بلا إرجاع.
 * يُرجع نسخة مخلوطة دون تعديل الأصل.
 */
export function secureShuffle<T>(items: readonly T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * اختيار n فائزين دون تكرار من مجموعة المؤهلين.
 * إن كان عدد المؤهلين أقل من المطلوب، يُرجع المتاح كلّه.
 */
export function drawWinners<T>(eligible: readonly T[], n: number): T[] {
  if (n <= 0 || eligible.length === 0) return [];
  return secureShuffle(eligible).slice(0, Math.min(n, eligible.length));
}
