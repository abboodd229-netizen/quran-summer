import { Router } from 'express';
import { asyncHandler } from '../../middlewares/http';
import { requireAuth, requirePermission } from '../../middlewares/auth';
import { buildWeeklyReport } from './reports.service';

export const reportsRouter = Router();

reportsRouter.get(
  '/week/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const report = buildWeeklyReport(Number(req.params.id));
    res.json({ report });
  }),
);

/** عرض HTML مهيّأ للطباعة → PDF (عربي RTL) */
reportsRouter.get(
  '/week/:id/print',
  requireAuth,
  requirePermission('export_reports'),
  asyncHandler(async (req, res) => {
    const r = buildWeeklyReport(Number(req.params.id));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderHtml(r));
  }),
);

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function renderHtml(r: ReturnType<typeof buildWeeklyReport>): string {
  const lotteryRows = r.lottery
    .map(
      (l) => `<tr>
        <td>${esc(l.groupName)}</td>
        <td>${l.winners.length ? l.winners.map(esc).join('، ') : '—'}</td>
        <td class="c">${l.eligibleCount}</td>
        <td class="c">${l.status === 'final' ? 'معتمد' : l.status === 'draft' ? 'مسودّة' : 'لم يُجرَ'}</td>
      </tr>`,
    )
    .join('');
  const excRows = r.excellence
    .map(
      (e) => `<tr>
        <td>${esc(e.circleName)}</td>
        <td>${e.winner ? esc(e.winner) : '<span class="muted">' + esc(e.state) + '</span>'}</td>
      </tr>`,
    )
    .join('');
  const disqRows = r.disqualified.length
    ? r.disqualified
        .map(
          (d) => `<tr><td>${esc(d.name)}</td><td>${esc(d.circleName)}</td><td>${d.reasons.map(esc).join('، ')}</td></tr>`,
        )
        .join('')
    : `<tr><td colspan="3" class="c muted">لا يوجد مستبعدون</td></tr>`;

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>تقرير ${esc(r.week.label)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  :root{--green:#215E35;--gold:#C6A83D;--ink:#1C2620;--muted:#5B6B61;--line:#E7E9E5;--bg:#F8F7F2}
  *{box-sizing:border-box}
  body{font-family:'Tajawal',system-ui,'Segoe UI',sans-serif;color:var(--ink);background:#fff;margin:0;padding:32px;line-height:1.7}
  .head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid var(--green);padding-bottom:16px;margin-bottom:24px}
  .head h1{margin:0;font-size:22px;color:var(--green)}
  .head .sub{color:var(--muted);font-size:14px}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
  .stat{border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center;background:var(--bg)}
  .stat .n{font-size:26px;font-weight:800;color:var(--green)}
  .stat .l{font-size:13px;color:var(--muted)}
  h2{font-size:18px;color:var(--green);margin:24px 0 10px;border-right:4px solid var(--gold);padding-right:10px}
  table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:14px}
  th,td{border:1px solid var(--line);padding:8px 10px;text-align:right}
  th{background:#F1F7F3;color:var(--green);font-weight:700}
  td.c{text-align:center}
  .muted{color:var(--muted)}
  .print-btn{position:fixed;left:24px;bottom:24px;background:var(--green);color:#fff;border:none;border-radius:12px;padding:12px 20px;font-family:inherit;font-size:15px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.15)}
  @media print{.print-btn{display:none}body{padding:0}}
</style></head>
<body>
  <div class="head">
    <div><h1>تقرير ${esc(r.week.label)}</h1><div class="sub">الجمعية الخيرية لتحفيظ القرآن الكريم بجازان — الحلقات الصيفية</div></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="n">${r.stats.totalStudents}</div><div class="l">إجمالي الطلاب</div></div>
    <div class="stat"><div class="n">${r.stats.eligible}</div><div class="l">المؤهلون</div></div>
    <div class="stat"><div class="n">${r.stats.disqualified}</div><div class="l">المستبعدون</div></div>
    <div class="stat"><div class="n">${r.stats.excellenceDecided}/${r.stats.totalCircles}</div><div class="l">متميّزو الحلقات</div></div>
  </div>
  <h2>الفائزون بالسحب (لكل مجموعة)</h2>
  <table><thead><tr><th>المجموعة</th><th>الفائزون</th><th>المؤهلون</th><th>الحالة</th></tr></thead><tbody>${lotteryRows}</tbody></table>
  <h2>متميّز كل حلقة</h2>
  <table><thead><tr><th>الحلقة</th><th>المتميّز</th></tr></thead><tbody>${excRows}</tbody></table>
  <h2>الطلاب المستبعدون وأسبابهم</h2>
  <table><thead><tr><th>الطالب</th><th>الحلقة</th><th>السبب</th></tr></thead><tbody>${disqRows}</tbody></table>
  <button class="print-btn" onclick="window.print()">طباعة / حفظ PDF</button>
</body></html>`;
}
