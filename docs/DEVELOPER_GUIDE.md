# دليل المطوّر — منصة الحلقات الصيفية

**النسخة:** 1.0 — مرجع داخلي شامل للمطوّرين الجدد والمساهمين المستقبليين.

---

## الفهرس

1. [أوامر البناء](#1-أوامر-البناء)
2. [بنية المشروع](#2-بنية-المشروع)
3. [بنية الخادم](#3-بنية-الخادم)
4. [بنية العميل](#4-بنية-العميل)
5. [توثيق قاعدة البيانات](#5-توثيق-قاعدة-البيانات)
6. [قواعد الأعمال](#6-قواعد-الأعمال)
7. [نظام التصميم](#7-نظام-التصميم)
8. [متغيرات البيئة](#8-متغيرات-البيئة)
9. [دليل التوسعة](#9-دليل-التوسعة)
10. [قواعد التطوير الآمن](#10-قواعد-التطوير-الآمن)
11. [الوحدات المحمية](#11-الوحدات-المحمية)
12. [ملاحظات التطوير المستقبلي](#12-ملاحظات-التطوير-المستقبلي)

---

## 1. أوامر البناء

### كل أوامر npm

| الأمر | الوصف |
|---|---|
| `npm install` | يثبّت حزم الـ workspaces الثلاثة ويشغّل `postinstall` الذي يبني `shared` تلقائيًا |
| `npm run build` | يبني بالترتيب: `shared` ← `client` ← `server` |
| `npm run build:shared` | يبني حزمة `shared` فقط (يشغّل `tsc` داخلها) |
| `npm run build:client` | يبني الواجهة فقط باستخدام Vite |
| `npm run build:server` | يبني الخادم فقط باستخدام `tsc` ثم ينسخ `data.json` |
| `npm run dev` | يبني `shared` ثم يشغّل الخادم (8080) والواجهة (5173) معًا بـ `concurrently` |
| `npm run dev:server` | يشغّل الخادم وحده بـ `tsx watch` (إعادة تشغيل عند التغيير) |
| `npm run dev:client` | يشغّل Vite dev server وحده |
| `npm run seed` | يهيّئ قاعدة البيانات: مجموعات + حلقات + أسابيع + 204 طالب + حساب المدير |
| `npm start` | يشغّل `dist/index.js` مباشرة (الإنتاج — يخدم الواجهة المبنية أيضًا) |

### ترتيب البناء الصحيح

```
shared → client → server
```

**لماذا يجب أن تُبنى `shared` أولًا؟**

تحتوي `shared` على الثوابت والأنواع ومخططات Zod المشتركة. كلٌّ من `client` و`server` يستوردان منها عبر اسم الحزمة `@quran/shared`. عند تثبيت الحزم، npm يُنشئ رابطًا رمزيًا من `node_modules/@quran/shared` إلى مجلد `shared/`، لكنه يشير إلى `shared/dist/` (المحدد في `shared/package.json` → `main`). إذا لم تُبنَ `shared` أولًا، فلن يجد المستهلكان الملفات المُجمَّعة ويفشل البناء.

هذا هو سبب وجود خطاف `postinstall` في `package.json` الجذر: يبني `shared` تلقائيًا فور انتهاء `npm install`.

### تسلسل التحقق الكامل (الإنتاج)

```bash
npm install      # تثبيت + بناء shared تلقائيًا
npm run build    # بناء client + server
npm run seed     # تهيئة قاعدة البيانات
npm run dev      # تشغيل للتحقق المحلي
```

إذا فشل أيٌّ من هذه الأوامر **توقّف، أصلح المشكلة، أعد من البداية**.

---

## 2. بنية المشروع

### نظرة عامة — Monorepo بـ npm Workspaces

```
quran-summer/
├─ package.json          ← الجذر: scripts ، devDependencies (concurrently)
├─ shared/               ← الحزمة المشتركة
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ src/
│     ├─ constants.ts    ← معايير ، صلاحيات ، أدوار ، أيام الأسبوع
│     ├─ types.ts        ← واجهات TypeScript المشتركة
│     ├─ schemas.ts      ← مخططات Zod للتحقق
│     └─ index.ts        ← تصدير موحّد
├─ server/               ← تطبيق Express
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ src/
│     ├─ index.ts        ← نقطة دخول: إنشاء الخادم + الجدولة
│     ├─ app.ts          ← تجميع الوسطاء + تسجيل المسارات
│     ├─ config/         ← env.ts ، logger.ts
│     ├─ db/             ← اتصال قاعدة البيانات ، المخطط ، البذور
│     ├─ core/           ← المحرّكات الأساسية
│     ├─ middlewares/    ← مصادقة ، http utilities
│     ├─ modules/        ← مجلد لكل نطاق
│     ├─ types/          ← express.d.ts (توسعة Request)
│     └─ utils/          ← errors ، time ، lockTime
├─ client/               ← تطبيق React
│  ├─ package.json
│  ├─ vite.config.ts
│  ├─ tailwind.config.ts
│  ├─ tsconfig.json
│  └─ src/
│     ├─ main.tsx        ← نقطة دخول React
│     ├─ index.css       ← Tailwind + مكوّنات CSS
│     ├─ app/            ← سياقات ، توجيه ، هيكل
│     ├─ components/     ← مكتبة UI مشتركة
│     ├─ features/       ← صفحة لكل نطاق
│     └─ lib/            ← api.ts ، sse.ts
└─ docs/                 ← توثيق المشروع
```

### مسؤوليات كل حزمة

**`shared/`** — مصدر الحقيقة الوحيد للعقد المشتركة:
- ثوابت المجال (المعايير الأربعة، الأدوار، الصلاحيات، أيام الأسبوع)
- أنواع TypeScript (الواجهات: `Student`, `Lottery`, `DashboardData`, ...)
- مخططات Zod للتحقق من المدخلات (تُستخدم على الخادم لـ `validateBody` وعلى العميل لأنواع الاستجابة)
- **لا تحتوي على منطق أعمال، لا تستورد من الخادم أو العميل**

**`server/`** — منطق الأعمال + قاعدة البيانات + API:
- SQLite عبر `better-sqlite3` (متزامن، مؤشر ترابط واحد)
- Express 4 مع مسارات RESTful تحت `/api`
- المصادقة بالجلسات في قاعدة البيانات + كوكي httpOnly
- SSE للتحديثات اللحظية
- النسخ الاحتياطي اليومي التلقائي

**`client/`** — واجهة المستخدم التفاعلية:
- React 18 + React Router 6 + TanStack Query 5
- Tailwind CSS (RTL العربي)
- يتواصل مع الخادم حصريًا عبر `/api/*`

### تدفق خدمة الإنتاج

```
المستخدم → المتصفح
            ↓
         GET /  (أو أي مسار React)
            ↓
         Express (يخدم client/dist/index.html)
            ↓
         React يُجهّز DOM ← يستدعي /api/* ← Express API handlers
```

في الإنتاج يعمل الخادم على المنفذ 8080 ويخدم الواجهة المبنية مباشرة من `client/dist/`. لا يوجد Nginx أو proxy منفصل في البيئة الافتراضية.

### دورة حياة الطلب

```
HTTP Request
     ↓
helmet (أمان Headers)
     ↓
pino-http (سجل الطلبات)
     ↓
express.json (تحليل JSON)
     ↓
cookieParser (قراءة الكوكيز)
     ↓
attachUser (تحميل المستخدم من الجلسة — لا يرفض إن لم يكن موجودًا)
     ↓
/api router
     ↓
requireAuth / requirePermission / assertCircleScope (حراسة المسار)
     ↓
validateBody(zodSchema) (التحقق من المدخلات)
     ↓
asyncHandler(fn) (تنفيذ المنطق + التقاط الأخطاء غير المتزامنة)
     ↓
tx(() => { ... }) (كتابة داخل معاملة SQLite)
     ↓
writeAudit() (تسجيل التدقيق داخل نفس المعاملة)
     ↓
broadcast() (إشعار SSE للعملاء المتصلين)
     ↓
res.json(result)
     ↓
errorHandler (يلتقط AppError → يحوّله إلى JSON موحّد)
```

---

## 3. بنية الخادم

### مسؤوليات المجلدات

| المجلد | المحتوى | المسؤولية |
|---|---|---|
| `config/` | `env.ts`, `logger.ts` | قراءة متغيرات البيئة، تهيئة pino |
| `db/` | `index.ts`, `schema.ts`, `schema.sql`, `seed/` | اتصال SQLite، تطبيق المخطط، البذور |
| `core/` | `eligibility.ts`, `lottery.ts`, `status.ts`, `audit.ts`, `sse.ts`, `backup.ts` | المحرّكات الأساسية — لا تعتمد على المسارات |
| `middlewares/` | `auth.ts`, `http.ts` | حراسة المسارات، التحقق، معالجة الأخطاء |
| `modules/` | مجلد لكل نطاق | مسارات Express مُصدَّرة كـ Router |
| `types/` | `express.d.ts` | توسعة `Request` لإضافة `user?` و `sessionId?` |
| `utils/` | `errors.ts`, `time.ts`, `lockTime.ts` | أدوات مساعدة |

### طبقة قاعدة البيانات

**`db/index.ts`** يُصدِّر:

```typescript
export const db: Database;          // مثيل SQLite وحيد (singleton)
export function applySchema(): void; // يطبّق CREATE TABLE IF NOT EXISTS
export function tx<T>(fn: () => T): T; // يشغّل fn داخل معاملة ذرية
```

`applySchema()` تُستدعى تلقائيًا عند استيراد الوحدة، ما يعني أن المخطط يُطبَّق دائمًا قبل أي عبارة مُعدَّة في المسارات.

**الخصائص الجوهرية لـ SQLite المُهيَّأ:**
- `PRAGMA journal_mode = WAL` — أداء كتابة أفضل مع قراءة متزامنة
- `PRAGMA foreign_keys = ON` — تطبيق قيود العلاقات
- `PRAGMA busy_timeout = 5000` — انتظار 5 ثوانٍ قبل خطأ "قاعدة البيانات مشغولة"

**قاعدة استخدام `tx()`:**  
كل كتابة (INSERT / UPDATE / DELETE) يجب أن تحدث داخل `tx()`. استدعاءات `writeAudit()` تنتمي دائمًا إلى نفس معاملة التغيير الرئيسي. هذا يضمن الاتساق: إما التغيير + التدقيق معًا أو لا شيء.

### محرّك الأهلية

**الملف:** `core/eligibility.ts`

```typescript
function computeEligibility(events: MinimalEvent[]): EligibilityResult
```

دالة **نقية حتمية** (pure function) — لا جانبية، لا قاعدة بيانات، لا حالة خارجية. تستقبل أحداث الطالب لأسبوع وتُرجع حالة الأهلية.

**المنطق:**
- حلقة على كل حدث ← إذا كان `status = 'violation'` → تُضاف المعيار لمجموعة `violated`
- لكل معيار في `violated`:
  - `attendance/appearance/behavior` → يحجب السحب + التميّز
  - `curriculum` → يحجب التميّز فقط
- الأهلية للتميّز تشترط الأهلية للسحب أيضًا

**`core/status.ts`** يُغلِّف `computeEligibility` بطبقة قاعدة البيانات:
- `recomputeStudentWeek(studentId, weekId)` — يجلب أحداث الطالب، يحسب الأهلية، يكتب النتيجة في `student_week_status`
- `getStudentStatus(studentId, weekId)` — يقرأ من الكاش؛ إن لم يكن موجودًا يُرجع "مؤهل" (الافتراضي)

### محرّك السحب

**الملف:** `core/lottery.ts`

```typescript
function secureShuffle<T>(items: readonly T[]): T[]  // Fisher-Yates بـ crypto.randomInt
function drawWinners<T>(eligible: readonly T[], n: number): T[]  // يختار n فائزين بلا تكرار
```

`crypto.randomInt` — مولّد أرقام عشوائية تشفيري (ليس `Math.random()`). لا يُعدَّل هذا المحرّك أبدًا.

### نظام SSE

**الملف:** `core/sse.ts`

```typescript
function addClient(res: Response): () => void  // يُسجّل عميلًا، يُرجع دالة إلغاء التسجيل
function broadcast(event: string, data: unknown): void  // يُرسل حدثًا لكل العملاء
```

- كل عميل مُتصل (`GET /api/stream`) يُضاف إلى مجموعة `clients`
- نبضة كل 25 ثانية (`: ping\n\n`) لإبقاء الاتصال حيًّا عبر الوكلاء
- `broadcast()` تُستدعى بعد كل كتابة ناجحة في المسارات
- **أحداث SSE المُرسَلة:** `connected`, `activity`, `status`, `lottery_draw`, `lottery_final`

### سجل التدقيق

**الملف:** `core/audit.ts`

```typescript
function writeAudit(input: AuditInput): void
```

يكتب صفًا في `audit_logs`. **يُستدعى دائمًا داخل `tx()`** لضمان الاتساق.

حقول `AuditInput`:
```typescript
{
  userId: number | null;   // من نفّذ الإجراء
  action: string;          // مثال: 'create', 'evaluate', 'login', 'draw'
  entity: string;          // مثال: 'student', 'lottery', 'session'
  entityId?: string | number | null;
  before?: unknown;        // الحالة قبل التغيير
  after?: unknown;         // الحالة بعد التغيير
}
```

### نظام النسخ الاحتياطي

**الملف:** `core/backup.ts`

- `runBackup()` — يُنشئ نسخة SQLite كاملة في `data/backups/` بـ `VACUUM INTO`
- `scheduleBackups()` — يُشغَّل عند بدء الخادم، ينفّذ نسخة فورية ثم يجدول نسخة كل 24 ساعة
- يحتفظ بآخر N نسخة (افتراضيًا 14، يتحكم بها `BACKUP_KEEP`)
- `.unref()` على الـ interval لعدم منع إغلاق العملية

---

## 4. بنية العميل

### التوجيه

**الملف:** `app/router.tsx`

يستخدم `createBrowserRouter` من React Router 6. هيكل المسارات:

```
/login                       ← LoginPage (بدون حماية)
/present/lottery             ← LotteryPresentationPage (بحماية، بدون shell)
/                            ← AppShell (حماية بـ Guard)
  index                      ← DashboardPage
  weeks                      ← WeeksPage
  circles                    ← CirclesPage
  circles/:id                ← CircleDetailsPage
  students/:id/timeline      ← StudentTimelinePage
  evaluation                 ← EvaluationPage
  excellence                 ← ExcellencePage
  lottery                    ← LotteryControlPage
  reports                    ← ReportsPage
  users                      ← UsersPage
  settings                   ← SettingsPage
  profile                    ← ProfilePage
  activity                   ← ActivityPage
```

المكوّن `Guard` يتحقق من وجود `user` في `AuthContext`؛ يُحوِّل إلى `/login` إذا لم يكن المستخدم مسجلًا.

### AppState (الحالة العامة)

**الملف:** `app/AppState.tsx` → Hook: `useAppState()`

يُخزِّن:
- `weeks: Week[]` — قائمة الأسابيع (تُجلب مرة واحدة عند التشغيل)
- `weekId: number | null` — الأسبوع المحدد حاليًا (يُشارَك بين كل الصفحات)
- `setWeekId(id)` — لتغيير الأسبوع من محدّد الأسبوع في الرأس
- `currentWeek: Week | null` — الكائن الكامل للأسبوع المحدد
- `saveStatus / setSaveStatus` — يُعرض في الرأس (`يُحفظ…` / `تم الحفظ`)

**القاعدة:** أي صفحة تحتاج رقم الأسبوع تقرأه من `useAppState().weekId`. لا تُمرَّر رقم الأسبوع عبر props.

### المصادقة

**الملف:** `app/AuthContext.tsx` → Hook: `useAuth()`

يُخزِّن:
- `user: SessionUser | null` — بيانات المستخدم الحالي
- `loading: boolean` — ريثما يتم التحقق من الجلسة عند أول تحميل
- `login(username, password)` → `POST /api/auth/login`
- `logout()` → `POST /api/auth/logout`
- `refresh()` → `GET /api/auth/me` (لإعادة تحميل بيانات المستخدم)
- `can(...perms)` — التحقق من الصلاحيات

تسلسل التهيئة عند التشغيل:
1. `AuthProvider` يُنفِّذ `refresh()` (يستدعي `GET /api/auth/me`)
2. إذا نجح → `user` يُعيَّن
3. إذا فشل → `user = null` (غير مسجّل)
4. `loading = false` ← الصفحة تُعرض

### نظام الصلاحيات

```typescript
// في المكوّنات:
const { can, user } = useAuth();

can('view_dashboard')          // true إذا admin أو لديه هذه الصلاحية
can('evaluate_attendance', 'evaluate_curriculum')  // true إذا أيٌّ منهما موجود
user?.role === 'admin'         // admin يتجاوز كل الصلاحيات

// في الشريط الجانبي (nav.ts):
{ adminOnly: true }            // يظهر للمدير فقط
{ perms: ['view_dashboard'] }  // يظهر لمن يملك أيًّا من هذه الصلاحيات
{ /* بدون perms */ }           // يظهر لكل مسجّل
```

**على الخادم:**
```typescript
requireAuth              // يتطلب جلسة صالحة فقط
requirePermission('x')   // المدير يتجاوز، المساعد يحتاج الصلاحية
requireAdmin             // للمدير فقط (دون تجاوز)
assertCircleScope(req, circleId)  // يتحقق أن الحلقة ضمن نطاق المساعد
```

### مكتبة UI

**الملف:** `components/ui.tsx`

| المكوّن | الاستخدام |
|---|---|
| `Button` | زر مع variants: `primary/secondary/ghost/gold/danger` وأحجام `sm/md/lg` و `loading` |
| `Card` | حاوية بيضاء مع ظل وحدود دائرية |
| `Modal` | نافذة منبثقة مع `open/onClose/title/footer` |
| `PageHeader` | رأس الصفحة مع العنوان والعنوان الفرعي وزر إجراء |
| `StatCard` | بطاقة إحصاء قابلة للنقر (للوحة التحكم) |
| `TextField` | حقل إدخال مع label وعرض خطأ |
| `Chip` | شارة صغيرة: `ok/gray/warn/gold` |
| `ProgressBar` | شريط تقدم بقيمة 0–100 |
| `EmptyState` | عرض الحالة الفارغة مع عنوان وزر اختياري |
| `Skeleton` | وميض تحميل |
| `Toggle` | مفتاح تبديل نعم/لا |
| `Spinner` | مؤشر دوار |

### نظام التخطيط

**`AppShell`** — الهيكل الرئيسي:
- `<aside>` — شريط جانبي يميني عرضه 64 (16rem)، ثابت في شاشة كبيرة، قابل للإخفاء في الجوال
- `<header>` — رأس لاصق يحتوي زر القائمة (جوال) + محدّد الأسبوع + مؤشر الحفظ + زر الخروج
- `<main>` — المحتوى (`<Outlet />`)

على الجوال: الشريط الجانبي يظهر من اليمين (RTL) بتحريك CSS، مع overlay داكن.

### تنفيذ RTL

- HTML جذر بـ `dir="rtl"` و `lang="ar"` (في `client/index.html`)
- خط Tajawal من Google Fonts (عربي-لاتيني)
- Tailwind مُهيَّأ بـ RTL تلقائيًا: `text-right` هو الافتراضي، الشريط الجانبي على اليمين
- المسافات والهوامش تتبع RTL (بداية = اليمين، نهاية = اليسار)
- لا يوجد `dir="rtl"` على عناصر فردية — المستند بأكمله RTL

---

## 5. توثيق قاعدة البيانات

### خريطة الجداول

```
lottery_groups ──┬── circles ──┬── students ──── student_events
                 │             │                └── student_week_status  [كاش]
                 │             └── user_circles
                 │             └── excellence_winners
                 │
                 └── lotteries ──── lottery_winners
                                
weeks ─────────────────────────── student_events
                                └── student_week_status
                                └── lotteries
                                └── excellence_winners

users ──┬── user_permissions
        ├── user_circles
        ├── sessions
        ├── resource_locks
        ├── audit_logs
        ├── student_events (created_by)
        ├── lotteries (performed_by)
        └── excellence_winners (selected_by)

app_settings (مستقل)
```

---

### جدول: `lottery_groups`

**الغرض:** مجموعات السحب الخمس (كل مجموعة تضم عدة حلقات).  
**المفتاح الأساسي:** `id INTEGER`  
**العلاقات:** مرجع من `circles.group_id` ومن `lotteries.group_id`  
**القيود:** `name UNIQUE`, `sort_order` يحدد ترتيب العرض  
**من يعدّله:** البذور فقط (`seed.ts`) — لا يتغير خلال التشغيل  
**ملاحظة:** ⚠️ ثابت في الإنتاج. لا تُضف مجموعات إلا بموافقة عمل.

---

### جدول: `circles`

**الغرض:** الحلقات الدراسية (14 حلقة موزعة على 5 مجموعات).  
**المفتاح الأساسي:** `id INTEGER`  
**العلاقات:** `group_id → lottery_groups.id`, ← `students.circle_id`, ← `user_circles.circle_id`, ← `excellence_winners.circle_id`  
**القيود:** `name UNIQUE`, `sort_order` يحدد ترتيب العرض  
**من يعدّله:** البذور + (مستقبلًا) واجهة إدارة الحلقات — المدير فقط

---

### جدول: `weeks`

**الغرض:** الأسابيع الأربعة للبرنامج (مُسبقة التحديد، لا تتغير).  
**المفتاح الأساسي:** `id INTEGER`  
**العلاقات:** ← `student_events.week_id`, ← `student_week_status.week_id`, ← `lotteries.week_id`, ← `excellence_winners.week_id`  
**القيود:** `number UNIQUE`, تواريخ اختيارية (`start_date`, `end_date`)  
**من يعدّله:** البذور فقط — لا تُعدَّل بعد الإنتاج  
**ملاحظة:** ⚠️ ثابت. 4 أسابيع فقط طوال البرنامج.

---

### جدول: `users`

**الغرض:** حسابات المستخدمين (مدير + مساعدون).  
**المفتاح الأساسي:** `id INTEGER`  
**العلاقات:** ← `user_permissions`, ← `user_circles`, ← `sessions`, ← `resource_locks`, ← `audit_logs`  
**القيود:** `username UNIQUE`, `role CHECK ('admin','assistant')`, `is_active` للتعطيل الناعم, كلمة المرور مُشفَّرة بـ bcrypt  
**من يعدّله:** `modules/users/`, `modules/auth/`

---

### جدول: `user_permissions`

**الغرض:** صلاحيات المساعد الذرية.  
**المفتاح الأساسي:** `(user_id, permission)` مركّب  
**العلاقات:** `user_id → users.id ON DELETE CASCADE`  
**القيود:** `ON DELETE CASCADE` — تُحذف تلقائيًا عند حذف المستخدم  
**من يعدّله:** `modules/users/`  
**ملاحظة:** المدير لا يملك صفوفًا هنا — يتجاوز الصلاحيات بالكود مباشرة.

---

### جدول: `user_circles`

**الغرض:** نطاق الحلقات لكل مساعد (المدير ليس في هذا الجدول).  
**المفتاح الأساسي:** `(user_id, circle_id)` مركّب  
**العلاقات:** `user_id → users.id ON DELETE CASCADE`, `circle_id → circles.id ON DELETE CASCADE`  
**من يعدّله:** `modules/users/`

---

### جدول: `students`

**الغرض:** بيانات الطلاب (204 طالب في الإنتاج).  
**المفتاح الأساسي:** `id INTEGER`  
**العلاقات:** `circle_id → circles.id`, ← `student_events`, ← `student_week_status`, ← `lottery_winners`, ← `excellence_winners`  
**القيود:** `is_active` للتعطيل الناعم (لا حذف فعلي — للحفاظ على السجل التاريخي)  
**من يعدّله:** `modules/students/`  
**ملاحظة:** لا تحذف طالبًا فعليًا أبدًا — استخدم `is_active = 0`.

---

### جدول: `student_events`

**الغرض:** سجل التقييم — خلية واحدة لكل (طالب × أسبوع × معيار × يوم).  
**المفتاح الأساسي:** `id INTEGER`  
**العلاقات:** `student_id → students.id ON DELETE CASCADE`, `week_id → weeks.id`, `created_by → users.id`  
**القيود الحرجة:**
```sql
UNIQUE INDEX ux_events_cell ON (student_id, week_id, criterion, IFNULL(day_date,''))
```
هذا الفهرس الفريد هو ما يُتيح الـ upsert (تحديث أو إنشاء بناءً على نفس المفتاح المنطقي).  
**معايير يومية:** `attendance/appearance/behavior` — تحتاج `day_date`  
**معايير أسبوعية:** `curriculum` — `day_date = NULL`  
**من يعدّله:** `modules/events/` فقط  
**ملاحظة:** ⚠️ لا تكتب في هذا الجدول مباشرة من أي وحدة أخرى. استخدم `POST /api/events`.

---

### جدول: `student_week_status` — **جدول كاش**

**الغرض:** كاش محسوب لأهلية كل طالب في كل أسبوع.  
**المفتاح الأساسي:** `(student_id, week_id)` مركّب  
**العلاقات:** `student_id → students.id ON DELETE CASCADE`, `week_id → weeks.id`  
**⚠️ تحذير: لا تكتب في هذا الجدول مباشرة أبدًا.**  
كل كتابة يجب أن تمر عبر `recomputeStudentWeek(studentId, weekId)` في `core/status.ts`.  
القيم الافتراضية (عند غياب الصف): `lotteryEligible = true`, `excellenceEligible = true`.  
**من يعدّله:** `core/status.ts` فقط، يُستدعى من `modules/events/`.

---

### جدول: `lotteries`

**الغرض:** نتائج السحب لكل مجموعة لكل أسبوع.  
**المفتاح الأساسي:** `id INTEGER`  
**العلاقات:** `week_id → weeks.id`, `group_id → lottery_groups.id`, `performed_by → users.id`, ← `lottery_winners`  
**القيود:** `UNIQUE (week_id, group_id)` — سحب واحد فقط لكل مجموعة في الأسبوع, `status CHECK ('draft','final')`  
**الانتقال:** `draft → final` فقط (في السير الطبيعي). `final` لا يُعاد سحبه.  
**من يعدّله:** `modules/lottery/` فقط

---

### جدول: `lottery_winners`

**الغرض:** الفائزون بالسحب مع ترتيب الظهور.  
**المفتاح الأساسي:** `id INTEGER`  
**العلاقات:** `lottery_id → lotteries.id ON DELETE CASCADE`, `student_id → students.id`  
**القيود:** `ON DELETE CASCADE` — تُحذف تلقائيًا إذا حُذف السحب  
**من يعدّله:** `modules/lottery/` فقط

---

### جدول: `excellence_winners`

**الغرض:** متميّز كل حلقة لكل أسبوع.  
**المفتاح الأساسي:** `id INTEGER`  
**العلاقات:** `week_id → weeks.id`, `circle_id → circles.id`, `student_id → students.id`, `selected_by → users.id`  
**القيود:** `UNIQUE (week_id, circle_id)` — متميّز واحد فقط لكل حلقة في الأسبوع  
**من يعدّله:** `modules/excellence/` فقط (عبر upsert — يستبدل التلقائي بالمختار)

---

### جدول: `audit_logs`

**الغرض:** سجل تدقيق غير قابل للتعديل لكل إجراء في المنصة.  
**المفتاح الأساسي:** `id INTEGER`  
**القيود:** لا حذف، لا تعديل — INSERT فقط  
**⚠️ لا يُحذف ولا يُعدَّل هذا الجدول أبدًا. سجل ثابت.**  
**من يعدّله:** `core/audit.ts` → `writeAudit()` فقط

---

### جدول: `resource_locks`

**الغرض:** أقفال ناعمة للتحرير المتزامن (مثل: مستخدمان يعدّلان نفس الحلقة).  
**المفتاح الأساسي:** `(resource_type, resource_id)` مركّب  
**العلاقات:** `user_id → users.id ON DELETE CASCADE`  
**القيود:** TTL = 30 ثانية — يتجدد بـ heartbeat كل 15 ثانية من العميل  
**من يعدّله:** `modules/locks/` فقط

---

### جدول: `sessions`

**الغرض:** جلسات المصادقة (بديل JWT).  
**المفتاح الأساسي:** `id TEXT` (UUID عشوائي)  
**العلاقات:** `user_id → users.id ON DELETE CASCADE`  
**القيود:** `expires_at` — تُتحقق يدويًا في `loadSessionUser()`. لا تنظيف تلقائي (يُنظَّف عند انتهاء الصلاحية عند القراءة).  
**من يعدّله:** `modules/auth/auth.service.ts` فقط

---

### جدول: `app_settings`

**الغرض:** إعدادات قابلة للتعديل وقت التشغيل (مفتاح/قيمة).  
**المفتاح الأساسي:** `key TEXT`  
**المفاتيح الحالية:** `lottery_default_winners` (افتراضي: 3)  
**من يعدّله:** `modules/settings/` — المدير فقط

---

## 6. قواعد الأعمال

> ⚠️ **لا تُعدَّل هذه القواعد بدون موافقة عمل صريحة.**

### الأهلية الأسبوعية

```
مؤهل للسحب = لا مخالفة في [حضور | مظهر | سلوك] طوال الأسبوع
مؤهل للتميّز = مؤهل للسحب + لا مخالفة منهج

إذا كان غير مؤهل للسحب → تلقائيًا غير مؤهل للتميّز
```

المعايير الأربعة:
- `attendance` — حضور (يومي، يحجب السحب والتميّز)
- `appearance` — مظهر (يومي، يحجب السحب والتميّز)
- `behavior` — سلوك (يومي، يحجب السحب والتميّز)
- `curriculum` — منهج (أسبوعي، يحجب التميّز فقط)

الأهلية **تُعاد حسابها فوريًا** بعد كل تقييم. لا دفعات، لا جداول.

كل أسبوع **مستقل** — مخالفة في الأسبوع الأول لا تؤثر على الأسبوع الثاني.

الحالة الافتراضية لطالب لم يُقيَّم بعد: **مؤهل** (يُفترض البراءة).

---

### التميّز الأسبوعي

```
لكل حلقة لكل أسبوع → متميّز واحد فقط

إذا كان المؤهلون للتميّز = 0       → لا متميّز (state: 'none')
إذا كان المؤهلون للتميّز = 1       → تعيين تلقائي فوري (state: 'auto')
إذا كان المؤهلون للتميّز > 1       → انتظار اختيار يدوي (state: 'manual_pending')
بعد الاختيار اليدوي              → (state: 'manual_done')
```

التعيين التلقائي يحدث عند قراءة `GET /api/excellence` إن وُجد مؤهل وحيد.  
يمكن استبدال المتميّز لاحقًا (upsert).

---

### سير عمل السحب

```
مرحلة 1: مسودّة (draft)
  ← المدير/المفوَّض ينفّذ السحب
  ← الخادم يختار الفائزين بـ secureShuffle (تشفيري)
  ← النتيجة تُعرض للمراجعة
  ← يمكن إعادة السحب (draft يُستبدل)

مرحلة 2: نهائي (final)
  ← المدير/المفوَّض يعتمد النتيجة
  ← لا يمكن تعديلها (409 Conflict إذا حاولت)
  ← تُعرض في شاشة البروجكتر (SSE)
```

القيود:
- سحب واحد فقط لكل `(week, group)` — `UNIQUE (week_id, group_id)`
- الفائزون يُختارون من المؤهلين للسحب في المجموعة فقط
- إذا كان المؤهلون أقل من العدد المطلوب → كلهم يفوزون
- `winnersCount` الافتراضي: `lottery_default_winners` من الإعدادات (3)

---

### صلاحيات المستخدم

**الأدوار:**
- `admin` — يتجاوز كل الصلاحيات ونطاق الحلقات
- `assistant` — مقيَّد بقائمة صلاحيات + نطاق حلقات

**الصلاحيات الذرية (14 صلاحية):**

| الصلاحية | المعنى |
|---|---|
| `view_dashboard` | عرض لوحة التحكم |
| `view_circle` | عرض الحلقات |
| `view_student_timeline` | عرض تاريخ الطالب |
| `evaluate_attendance` | تقييم الحضور |
| `evaluate_appearance` | تقييم المظهر |
| `evaluate_behavior` | تقييم السلوك |
| `evaluate_curriculum` | تقييم المنهج |
| `run_lottery` | تشغيل السحب |
| `select_excellence` | تحديد المتميّز |
| `manage_students` | إدارة الطلاب |
| `export_reports` | تصدير التقارير |
| `view_audit` | عرض سجل النشاط |
| `manage_users` | إدارة المستخدمين |
| `manage_settings` | إدارة الإعدادات |

**نطاق الحلقات:** المساعد يرى ويعدّل فقط الحلقات في `user_circles`. المدير يصل لكل الحلقات.

---

### قفل التحرير (Resource Locks)

لمنع تعارض التحرير المتزامن:
- العميل يطلب `POST /api/locks` عند فتح صفحة التقييم
- إذا الحلقة محجوزة بمستخدم آخر → `{ locked: true, mine: false, by: "الاسم" }` → يُعرض banner تحذيري
- إذا نجح الحجز → heartbeat كل 15 ثانية (`POST /api/locks/heartbeat`)
- عند مغادرة الصفحة → `DELETE /api/locks`
- TTL = 30 ثانية — القفل ينتهي تلقائيًا إذا انقطع العميل

---

## 7. نظام التصميم

### الألوان

```typescript
// brand — أخضر الأساسي (من خضرة القرآن)
brand: {
  50:  '#F1F7F3',  // خلفية خفيفة جدًا
  100: '#E3EFE7',  // chip ok، رأس جداول
  500: '#337948',  // —
  600: '#297446',  // تركيز، حدود محددة
  700: '#215E35',  // لون أساسي: أزرار، النص الرئيسي للعلامة التجارية
  800: '#1B4C2B',  // hover
  900: '#14391F',  // active
}

// gold — ذهبي للمكافآت والتميّز
gold: {
  100: '#F3E9CF',  // chip gold، تحذيرات ناعمة
  300: '#E2D1A7',
  500: '#C6A83D',  // زر gold
  600: '#AB913C',  // hover gold
  700: '#9A7E2E',  // نص gold
}

cream:   '#F8F7F2'  // خلفية الصفحة
ink:     '#1C2620'  // نص أساسي
muted:   '#5B6B61'  // نص ثانوي
line:    '#E7E9E5'  // حدود، فواصل
danger:  '#B4453A'  // أخطاء، مخالفات
warn:    '#C58A2E'  // تحذيرات
```

### الطباعة

- **الخط الأساسي:** Tajawal (Google Fonts) — عربي + لاتيني
- **fallback:** `system-ui`, `sans-serif`
- **التسلسل الهرمي:**
  - `text-xl font-extrabold` — عناوين الصفحات
  - `font-bold / font-semibold` — عناوين البطاقات
  - `text-sm` — محتوى الجداول
  - `text-xs text-muted` — تلميحات وملاحظات

### المكوّنات CSS (index.css)

```css
.card    — بطاقة بيضاء: rounded-xl shadow-card border border-line
.btn     — زر: inline-flex rounded-xl font-medium transition
.btn-{variant} — primary / secondary / ghost / gold / danger
.btn-{size}    — sm / md / lg
.input   — حقل إدخال كامل العرض
.chip    — شارة دائرية صغيرة
.chip-{variant} — ok / gray / warn / gold
```

### الأيقونات

الأيقونات نصية (Unicode) — لا مكتبة خارجية:
- `◧` لوحة، `◔` أسابيع، `◎` حلقات، `✦` تقييم
- `★` تميّز، `◈` سحب، `▤` تقارير، `◍` مستخدمون
- `◷` نشاط، `⚙` إعدادات

### المسافات والتخطيط

- `rounded-xl` (16px) — الزوايا القياسية للبطاقات والأزرار
- `p-4 sm:p-6` — padding الصفحة
- `p-5` — padding البطاقات
- `gap-3/4/5` — مسافات بين العناصر

### اتفاقيات RTL

- الشريط الجانبي دائمًا على **اليمين** (`right-0`)
- النص دائمًا `text-right` (الافتراضي في RTL)
- الجداول: اسم الطالب مُثبَّت يمينًا (`sticky right-0`)
- التمرير الأفقي: `overflow-x-auto` مع `min-w-[640px]` للجداول
- الزر `×` للإغلاق في الزاوية اليسرى العلوية من النوافذ المنبثقة
- النوافذ المنبثقة تُركِّز على المحتوى، الأزرار في الأسفل من اليسار

---

## 8. متغيرات البيئة

| المتغير | القيمة الافتراضية | الغرض | توصية الإنتاج |
|---|---|---|---|
| `NODE_ENV` | `development` | يُفعِّل CSP في الإنتاج، يُعطِّل بعض السجلات | يجب أن يكون `production` |
| `PORT` | `8080` | منفذ HTTP | اتركه افتراضيًا إلا لسبب |
| `DATABASE_PATH` | `./data/app.sqlite` | مسار ملف SQLite | مسار مطلق على حجم بيانات دائم |
| `SESSION_SECRET` | `dev-insecure-secret-change-me` | توقيع كوكي الجلسة | **ضروري تغييره** — سلسلة عشوائية ≥ 32 حرف |
| `SESSION_TTL_DAYS` | `7` | مدة صلاحية الجلسة | 7 أيام مناسب |
| `ADMIN_USERNAME` | `admin` | اسم حساب المدير الأولي (وقت البذر) | غيّره إذا أردت |
| `ADMIN_PASSWORD` | `Admin@12345` | كلمة مرور المدير الأولي | **ضروري تغييره** بعد أول دخول |
| `ADMIN_NAME` | `مدير النظام` | الاسم المعروض للمدير | غيّره حسب الاسم الفعلي |
| `BACKUP_ENABLED` | `true` | تفعيل النسخ الاحتياطي اليومي | اتركه `true` |
| `BACKUP_KEEP` | `14` | عدد نسخ الاحتياط المحتفظ بها | 14 يوم مناسب |

**ملاحظة:** متغيرات البيئة تُقرأ في `server/src/config/env.ts` فقط. لا تستخدمها مباشرة في أي مكان آخر — استورد `env` من هذا الملف.

---

## 9. دليل التوسعة

### إضافة صفحة جديدة

1. أنشئ `client/src/features/<name>/<Name>Page.tsx`
2. أضف مسارًا في `client/src/app/router.tsx`:
   ```typescript
   { path: '<name>', element: <NamePage /> }
   ```
3. إذا أردت رابطًا في الشريط الجانبي، أضفه في `client/src/app/nav.ts`:
   ```typescript
   { to: '/<name>', label: 'العنوان', icon: '◯', perms: ['permission_needed'] }
   ```
4. ابنِ ثم تحقق: `npm run build`

---

### إضافة نقطة نهاية API جديدة

1. أنشئ أو عدِّل `server/src/modules/<domain>/<domain>.routes.ts`
2. إذا الوحدة جديدة، صدِّر الـ Router وأضفه في `server/src/app.ts`:
   ```typescript
   import { newRouter } from './modules/new/new.routes';
   api.use('/new', newRouter);
   ```
3. أضف مخطط Zod للتحقق في `shared/src/schemas.ts` إذا احتجت
4. استخدم النمط القياسي:
   ```typescript
   newRouter.post('/', requireAuth, requirePermission('...'), validateBody(schema), asyncHandler(async (req, res) => {
     const result = tx(() => {
       // كتابة قاعدة البيانات
       writeAudit({ ... });
       return ...;
     });
     broadcast('event_name', result);
     res.json({ result });
   }));
   ```
5. ابنِ: `npm run build`

---

### إضافة جدول قاعدة بيانات

1. عدِّل `server/src/db/schema.sql` بجملة `CREATE TABLE IF NOT EXISTS`
2. انسخ المحتوى الكامل إلى ثابت `SCHEMA_SQL` في `server/src/db/schema.ts` (استبدل النص بالكامل)
3. أضف الأنواع اللازمة في `shared/src/types.ts` إذا احتجت
4. الجدول سيُنشأ تلقائيًا عند بدء الخادم (لأن `applySchema()` تستخدم `CREATE TABLE IF NOT EXISTS`)
5. **لا تحذف أو تعدِّل جداول قائمة** إذا كانت تحتوي بيانات — أنشئ جدولًا جديدًا أو أضف عمودًا إذا كان SQLite يسمح بذلك

---

### إضافة صلاحية جديدة

1. أضف الصلاحية إلى `PERMISSIONS` في `shared/src/constants.ts`
2. أضف تسميتها في `PERMISSION_LABELS`
3. ابنِ `shared`: `npm run build:shared`
4. أضفها إلى المسارات المطلوبة: `requirePermission('new_permission')`
5. عدِّل واجهة إدارة المستخدمين إذا أردت تمكين تعيينها

---

### إضافة تقرير جديد

1. أضف منطق البناء في `server/src/modules/reports/reports.service.ts`
2. أضف نقطة نهاية في `server/src/modules/reports/reports.routes.ts`
3. أضف نوع TypeScript في `client/src/features/reports/types.ts`
4. أضف قسمًا في `client/src/features/reports/ReportsPage.tsx`
5. قسم الطباعة يستخدم `@media print` — اتبع النمط الموجود

---

## 10. قواعد التطوير الآمن

### الدورة الإلزامية لكل تغيير

```
1. نفِّذ تغييرًا منطقيًا واحدًا
2. شغِّل: npm run build
3. إذا فشل البناء → أصلح الأخطاء قبل المتابعة
4. اختبر يدويًا
5. تأكد من أن الصفحات الأخرى لا تزال تعمل
6. انتقل للتغيير التالي
```

**لا تنفِّذ ميزتين غير مترابطتين في دورة واحدة.**

### قواعد كتابة الكود

**قاعدة البيانات:**
- كل كتابة تمر عبر `tx()`
- كل عملية `tx()` تستدعي `writeAudit()`
- لا تكتب في `student_week_status` مباشرة — استخدم `recomputeStudentWeek()`
- لا تحذف سجلات `audit_logs` أو `student_events` تاريخية

**الصلاحيات:**
- كل نقطة نهاية تعديل تبدأ بـ `requireAuth` على الأقل
- لا تثق بمدخلات العميل لتحديد نطاق الوصول — تحقق على الخادم
- استخدم `assertCircleScope` لكل عملية تخص حلقة بعينها

**الأنواع:**
- لا `any` في TypeScript — استخدم `unknown` ثم تحقق
- `lastInsertRowid` من better-sqlite3 هو `number | bigint` — دائمًا `Number(r.lastInsertRowid)` عند إرساله

**الواجهة:**
- كل طلب API يمر عبر `api.get/post/patch/del` في `lib/api.ts`
- كل جلب بيانات يستخدم `useQuery` من TanStack Query
- لا `fetch()` مباشرة في المكوّنات

---

## 11. الوحدات المحمية

> ⛔ هذه الوحدات يجب مراجعتها بعناية شديدة قبل أي تعديل.

### محرّك الأهلية — `core/eligibility.ts`

**⛔ لا تُعدِّل هذا الملف بدون موافقة عمل صريحة.**

`computeEligibility()` هي الدالة الوحيدة التي تُقرِّر من يدخل السحب ومن يصل للتميّز. أي تغيير فيها يُغيِّر نتائج كل الأسابيع الحالية والمستقبلية بأثر فوري.

قبل أي تعديل:
1. احصل على موافقة كتابية من الإدارة
2. اكتب الحالات المتوقعة بوضوح
3. اختبر على بيانات حقيقية في بيئة معزولة

---

### محرّك السحب — `core/lottery.ts`

**⛔ لا تُعدِّل هذا الملف بدون فهم عميق للتشفير.**

`secureShuffle()` يستخدم `crypto.randomInt` وليس `Math.random()`. استبدالها بمولّد أضعف يُخِلّ بعدالة السحب.

`drawWinners()` يضمن عدم التكرار وإعادة الحالة كاملة عند عدد مؤهلين أقل من المطلوب. هذا سلوك مقصود.

---

### قفل التحرير — `modules/locks/`

**⚠️ تعديل المهلة الزمنية (TTL) أو منطق heartbeat قد يسبب احتجاز الأقفال إلى الأبد.**

TTL = 30 ثانية، heartbeat = 15 ثانية: هذه المعادلة مقصودة. إذا انقطع العميل، القفل يتحرر خلال 30 ثانية.

---

### مخطط قاعدة البيانات — `db/schema.ts` + `db/schema.sql`

**⚠️ تعديل جداول قائمة قد يكسر البيانات الموجودة.**

القواعد:
- يمكن إضافة جداول جديدة (آمن)
- يمكن إضافة أعمدة بقيمة افتراضية (آمن غالبًا في SQLite)
- لا تحذف أعمدة (SQLite لا يدعمه مباشرة، وسيكسر الكود)
- لا تُغيِّر أنواع الأعمدة
- لا تُزِل قيود أو فهارس موجودة

---

### نظام الصلاحيات

**⚠️ إضافة صلاحية جديدة يتطلب تحديث ثلاثة أماكن في آن واحد:**

1. `shared/src/constants.ts` — `PERMISSIONS` + `PERMISSION_LABELS`
2. الخادم — `requirePermission('new_permission')` في المسارات المطلوبة
3. الواجهة — واجهة إدارة المستخدمين

إغفال أيٍّ منها يُنشئ صلاحية لا يمكن تعيينها للمستخدمين.

---

## 12. ملاحظات التطوير المستقبلي

### مبادئ الاستقرار

**لا تُغيِّر ما لم يكن مكسورًا أو مطلوبًا.** المنصة مصمَّمة لبرنامج محدد المدة (شهر واحد، 4 أسابيع). تعقيد التصميم غير مبرَّر.

**إبقاء الحزمة المشتركة صغيرة.** `shared/` يجب أن تبقى ثوابت + أنواع + Zod فقط. لا منطق أعمال.

**لا تُضِف مكتبات بدون حاجة.** المكتبات الحالية كافية. كل مكتبة جديدة = تبعية جديدة = احتمال تعارض.

### أداء قاعدة البيانات

SQLite مع WAL قادر على خدمة هذا الحجم (200 طالب، 4 أسابيع) بأداء ممتاز. لا تبدِّل إلى PostgreSQL أو MongoDB إلا إذا:
- تجاوزت عشرات الآلاف من الطلاب
- احتجت قراءات متزامنة من مثيلات خادم متعددة

### التحقق من المدخلات

**دائمًا** استخدم `validateBody(zodSchema)` للمسارات التي تستقبل بيانات. لا تتحقق يدويًا من المدخلات في منطق الأعمال — ضع الشيماتك في `shared/schemas.ts` واستخدمها على الجانبين.

### SSE مقابل WebSocket

SSE (الحل الحالي) أبسط من WebSocket وكافٍ لهذا الاستخدام (اتصال أحادي الاتجاه من الخادم للعميل). لا تُبدِّله بـ WebSocket إلا إذا احتجت تواصلًا ثنائيًا.

### النسخ الاحتياطي

`VACUUM INTO` ينتج ملف SQLite نظيفًا (مضغوطًا). هذا أكثر موثوقية من نسخ الملف مباشرة. لا تُغيِّر هذا النهج.

### الأمان

- `SESSION_SECRET` يجب أن يكون عشوائيًا حقيقيًا ≥ 32 بايت في الإنتاج
- CSP مُفعَّل فقط في الإنتاج (`NODE_ENV=production`)
- كوكي الجلسة: `httpOnly`, `sameSite: strict`, `secure` في الإنتاج
- bcrypt بكلفة 10 — لا تُخفِّضها (أداء vs أمان)

### اختبار التغييرات

قبل كل تسليم، تحقق من:
1. `npm run build` — يجب أن ينجح بلا أخطاء
2. تسجيل الدخول يعمل
3. التقييم يُحفظ تلقائيًا
4. الأهلية تُحسَب فورًا
5. السحب يعمل (مسودة + اعتماد)
6. التقارير تعرض بيانات صحيحة

---

*آخر تحديث: يونيو 2026*
