import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Lottery, Week } from '@quran/shared';
import { useSSE } from '@/lib/sse';
import { api } from '@/lib/api';

type Phase = 'groups' | 'rolling' | 'reveal';

function groupIcon(name: string): string {
  if (name.includes('تأسيس') || name.includes('قاعدة') || name.includes('مدني')) return 'ق';
  if (name.includes('جزأين') || name.includes('جزئين')) return '٢';
  if (name.includes('ثلاثة')) return '٣';
  if (name.includes('خمسة') && !name.includes('عشر')) return '٥';
  return '+١٠';
}

function statusBadge(l: Lottery) {
  if (l.status === 'final')
    return <span className="rounded-full bg-gold-500/20 px-3 py-1 text-xs font-bold text-gold-300">✦ معتمد</span>;
  if (l.winners.length > 0)
    return <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">مسودة</span>;
  return <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/30">لم يُجرَ</span>;
}

/** Scales the name to always sit on a single line within its container. */
function FitName({ name, maxPx = 72 }: { name: string; maxPx?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const span = spanRef.current;
    if (!wrap || !span) return;
    span.style.fontSize = `${maxPx}px`;
    const available = wrap.clientWidth * 0.88;
    const ratio = available / span.scrollWidth;
    span.style.fontSize = `${Math.max(Math.min(maxPx * ratio, maxPx), 18)}px`;
  }, [name, maxPx]);

  return (
    <div ref={wrapRef} className="flex w-full items-center justify-center overflow-hidden">
      <span
        ref={spanRef}
        className="block whitespace-nowrap font-extrabold text-white"
        style={{ lineHeight: 1.25 }}
      >
        {name}
      </span>
    </div>
  );
}

function Header({ weekLabel }: { weekLabel: string }) {
  return (
    <header className="relative z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-brand-800/60 px-8 py-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white p-1 ring-1 ring-white/20">
          <img src="/logo.png" alt="" className="h-full w-full object-contain"
            onError={(e) => {
              e.currentTarget.parentElement!.innerHTML =
                '<div style="height:100%;display:grid;place-items:center;font-size:24px;color:#C6A83D;font-weight:900;">ق</div>';
            }} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-gold-300">الجمعية الخيرية لتحفيظ القرآن الكريم بجازان</div>
          <div className="text-xs text-white/50">الحلقات الصيفية لعام 1448هـ</div>
        </div>
      </div>
      {weekLabel && (
        <div className="rounded-full border border-gold-500/30 bg-white/5 px-6 py-2 text-base font-bold text-gold-300">
          {weekLabel}
        </div>
      )}
      <div className="h-14 shrink-0">
        <img src="/logo-summer.png" alt="" className="h-full object-contain opacity-90"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════ */
export function LotteryPresentationPage() {
  const urlWeekId = Number(new URLSearchParams(window.location.search).get('week')) || 0;

  const [phase, setPhase]       = useState<Phase>('groups');
  const [active, setActive]     = useState<Lottery | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [rollName, setRollName] = useState('');
  const rollRef                  = useRef<number | null>(null);

  const { data: weeksData } = useQuery({
    queryKey: ['weeks-p'],
    queryFn: () => api.get<{ weeks: Week[] }>('/weeks'),
    retry: false,
  });

  const effectiveWeekId = urlWeekId || (weeksData?.weeks[0]?.id ?? 0);
  const weekLabel = weeksData?.weeks.find((w) => w.id === effectiveWeekId)?.label ?? '';

  const { data: lotteriesData, refetch } = useQuery({
    queryKey: ['lotteries-p', effectiveWeekId],
    queryFn: () =>
      api.get<{ lotteries: Lottery[]; defaultWinners: number }>(`/lotteries?week=${effectiveWeekId}`),
    enabled: effectiveWeekId > 0,
    retry: false,
  });

  const lotteries = lotteriesData?.lotteries ?? [];

  const startRolling = (l: Lottery) => {
    setActive(l);
    setRevealed(0);
    if (l.winners.length === 0) { setPhase('reveal'); return; }
    setPhase('rolling');
    const pool = l.winners.map((w) => w.studentName);
    let i = 0;
    if (rollRef.current) window.clearInterval(rollRef.current);
    rollRef.current = window.setInterval(() => { setRollName(pool[i++ % pool.length]); }, 80);
    setTimeout(() => {
      if (rollRef.current) window.clearInterval(rollRef.current);
      setPhase('reveal');
      refetch();
    }, 2400);
  };

  const selectGroup = (l: Lottery) => {
    if (rollRef.current) window.clearInterval(rollRef.current);
    setActive(l);
    setRevealed(0);
    setPhase('reveal');
  };

  useSSE({
    lottery_draw:  (d) => { startRolling(d as Lottery); refetch(); },
    lottery_final: (d) => { startRolling(d as Lottery); refetch(); },
  });

  useEffect(() => () => { if (rollRef.current) window.clearInterval(rollRef.current); }, []);

  const revealNext = () => {
    if (!active) return;
    setRevealed((c) => Math.min(c + 1, active.winners.length));
  };

  const backToGroups = () => {
    if (rollRef.current) window.clearInterval(rollRef.current);
    refetch();
    setPhase('groups');
  };

  const allRevealed = active ? revealed >= active.winners.length : false;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-brand-900 text-white">

      {/* ── Decorative background — no symbol, only light and stars ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-1/3  h-[500px] w-[500px] rounded-full bg-brand-700/45 blur-[110px]" />
        <div className="absolute -bottom-40 left-1/3 h-[400px] w-[400px] rounded-full bg-gold-700/15 blur-[90px]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[650px] w-[650px] rounded-full bg-brand-800/50 blur-[130px]" />
        </div>
        {/* Scattered ✦ stars — varied sizes and opacities */}
        <span className="absolute right-[7%]   top-[9%]    select-none text-[5.5rem] leading-none text-gold-400/[0.07]">✦</span>
        <span className="absolute left-[5%]    bottom-[11%] select-none text-[7.5rem] leading-none text-gold-400/[0.05]">✦</span>
        <span className="absolute left-[13%]   top-[19%]   select-none text-[2.5rem] leading-none text-gold-400/[0.09]">✦</span>
        <span className="absolute right-[10%]  bottom-[24%] select-none text-[3.5rem] leading-none text-gold-400/[0.07]">✦</span>
        <span className="absolute left-[42%]   top-[4%]    select-none text-[1.5rem] leading-none text-gold-400/[0.07]">✦</span>
        <span className="absolute right-[36%]  bottom-[7%] select-none text-[2rem]   leading-none text-gold-400/[0.06]">✦</span>
        <span className="absolute right-[22%]  top-[32%]   select-none text-[1rem]   leading-none text-gold-400/[0.08]">✦</span>
        <span className="absolute left-[28%]   bottom-[35%] select-none text-[1rem]   leading-none text-gold-400/[0.07]">✦</span>
      </div>

      <Header weekLabel={weekLabel} />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 py-10">

        {/* ═══ PHASE: Group selection ══════════════════════ */}
        {phase === 'groups' && (
          <div className="w-full max-w-5xl">
            <div className="mb-10 text-center">
              <div className="mb-3 flex items-center justify-center gap-3 text-sm font-medium tracking-[0.3em] text-gold-400/60">
                <span className="text-gold-500/40">✦</span>
                السحب الأسبوعي
                <span className="text-gold-500/40">✦</span>
              </div>
              <h1 className="text-4xl font-extrabold text-white">اختر المجموعة لعرض نتيجة السحب</h1>
            </div>

            {lotteries.length === 0 ? (
              <div className="flex flex-col items-center gap-5">
                <div className="h-16 w-16 rounded-full border-4 border-gold-500/20 border-t-gold-400 animate-spin" />
                <p className="animate-pulse-soft text-xl text-white/50">جارٍ تحميل بيانات السحب…</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
                {lotteries.map((l) => (
                  <button
                    key={l.groupId}
                    onClick={() => selectGroup(l)}
                    className={`group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border bg-white/5 px-4 py-8 text-center backdrop-blur-sm transition duration-200 hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-gold-400/60 ${
                      l.status === 'final'
                        ? 'border-gold-500/40 hover:border-gold-400/70 hover:bg-gold-500/10'
                        : l.winners.length > 0
                        ? 'border-brand-500/30 hover:border-brand-400/50 hover:bg-brand-700/20'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {l.status === 'final' && (
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
                    )}
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-white/10 text-3xl font-extrabold text-gold-300 ring-2 ring-white/10 transition duration-200 group-hover:bg-white/15 group-hover:ring-gold-400/40">
                      {groupIcon(l.groupName)}
                    </div>
                    <div className="text-sm font-bold leading-snug text-white">{l.groupName}</div>
                    <div className="text-xs text-white/50">{l.eligibleCount} مؤهل</div>
                    {statusBadge(l)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ PHASE: Rolling drum ════════════════════════ */}
        {phase === 'rolling' && active && (
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="rounded-2xl border border-gold-500/25 bg-white/5 px-12 py-5 backdrop-blur-sm">
              <div className="text-4xl font-extrabold text-white">{active.groupName}</div>
              <div className="mt-1 text-lg text-gold-300">{active.eligibleCount} مؤهل</div>
            </div>
            <div className="lottery-roll min-h-[1.2em] text-[min(12vw,100px)] font-extrabold text-gold-300 leading-tight">
              {rollName || '…'}
            </div>
          </div>
        )}

        {/* ═══ PHASE: Manual reveal ═══════════════════════ */}
        {phase === 'reveal' && active && (
          <div className="flex w-full max-w-3xl flex-col gap-5">

            {/* Top nav */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={backToGroups}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/15 hover:text-white"
              >
                ← المجموعات
              </button>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-white">{active.groupName}</div>
                <div className="mt-0.5 text-sm text-gold-300/80">
                  {active.eligibleCount} مؤهل
                  <span className="mx-2 text-white/20">·</span>
                  {active.winnersCount} {active.winnersCount === 1 ? 'فائز' : 'فائزون'}
                </div>
              </div>
              <div className="w-28 shrink-0" />
            </div>

            {/* No eligible */}
            {active.winners.length === 0 && (
              <p className="py-20 text-center text-3xl font-bold text-white/50">لا يوجد طلاب مؤهلون</p>
            )}

            {/* Winner cards — no numbers, auto-sized name */}
            <div className="space-y-3">
              {active.winners.slice(0, revealed).map((w, i) => (
                <div
                  key={w.studentId}
                  className={`winner-card relative overflow-hidden rounded-2xl border border-gold-500/20 bg-gradient-to-l from-gold-800/20 via-brand-800/40 to-gold-700/15 px-8 py-5 ${
                    i === revealed - 1 ? 'winner-glow' : ''
                  }`}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-600/20 to-transparent" />
                  <div className="flex items-center gap-4">
                    <span className="shrink-0 text-2xl text-gold-500/60">✦</span>
                    <FitName name={w.studentName} maxPx={68} />
                    <span className="shrink-0 text-2xl text-gold-500/60">✦</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Reveal-next button */}
            {active.winners.length > 0 && !allRevealed && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={revealNext}
                  className="group relative overflow-hidden rounded-2xl bg-gold-500 px-14 py-4 text-xl font-extrabold text-brand-900 shadow-pop transition hover:bg-gold-400 active:scale-95"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <span>✦</span>
                    <span>كشف الفائز التالي</span>
                  </span>
                  <div className="absolute inset-0 bg-white/0 transition group-hover:bg-white/10" />
                </button>
              </div>
            )}

            {/* Completion */}
            {active.winners.length > 0 && allRevealed && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <div className="text-2xl tracking-widest text-gold-400">✦ ✦ ✦</div>
                <p className="text-xl font-medium text-gold-300/80">نسأل الله أن يتقبل منهم ومنكم</p>
              </div>
            )}
          </div>
        )}

      </main>

      <footer className="relative z-10 border-t border-white/10 bg-brand-800/40 px-8 py-3 text-center text-xs text-white/25">
        صيفنا قرآن … حفظ وإتقان
      </footer>
    </div>
  );
}
