// مُولّد من schema.sql — لا تعدّله يدويًا، عدّل schema.sql ثم أعد التوليد
export const SCHEMA_SQL = `-- مخطّط قاعدة البيانات (SQLite) — يُطبّق بشكل idempotent عند الإقلاع
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lottery_groups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  default_lottery_group_id INTEGER REFERENCES lottery_groups(id)
);

CREATE TABLE IF NOT EXISTS circles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  group_id INTEGER NOT NULL REFERENCES lottery_groups(id),
  track_id INTEGER REFERENCES tracks(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_circles_group ON circles(group_id);

CREATE TABLE IF NOT EXISTS weeks (
  id INTEGER PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  label TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  is_locked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','assistant')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_circles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, circle_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  PRIMARY KEY (user_id, permission)
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  circle_id INTEGER NOT NULL REFERENCES circles(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_students_circle ON students(circle_id);

CREATE TABLE IF NOT EXISTS student_events (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  week_id INTEGER NOT NULL REFERENCES weeks(id),
  criterion TEXT NOT NULL CHECK (criterion IN ('attendance','appearance','behavior','curriculum')),
  status TEXT NOT NULL CHECK (status IN ('ok','violation')),
  day_date TEXT,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_swc ON student_events(student_id, week_id, criterion);
CREATE INDEX IF NOT EXISTS idx_events_week ON student_events(week_id);
-- خلية فريدة لكل (طالب، أسبوع، معيار، يوم): تسمح بالـ upsert
CREATE UNIQUE INDEX IF NOT EXISTS ux_events_cell
  ON student_events(student_id, week_id, criterion, IFNULL(day_date,''));

CREATE TABLE IF NOT EXISTS student_week_status (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  week_id INTEGER NOT NULL REFERENCES weeks(id),
  lottery_eligible INTEGER NOT NULL DEFAULT 1,
  excellence_eligible INTEGER NOT NULL DEFAULT 1,
  reasons TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_id, week_id)
);

CREATE TABLE IF NOT EXISTS lotteries (
  id INTEGER PRIMARY KEY,
  week_id INTEGER NOT NULL REFERENCES weeks(id),
  group_id INTEGER NOT NULL REFERENCES lottery_groups(id),
  winners_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','final')),
  performed_by INTEGER REFERENCES users(id),
  performed_at TEXT,
  UNIQUE (week_id, group_id)
);

CREATE TABLE IF NOT EXISTS lottery_winners (
  id INTEGER PRIMARY KEY,
  lottery_id INTEGER NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id),
  draw_order INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_winners_lottery ON lottery_winners(lottery_id);

CREATE TABLE IF NOT EXISTS excellence_winners (
  id INTEGER PRIMARY KEY,
  week_id INTEGER NOT NULL REFERENCES weeks(id),
  circle_id INTEGER NOT NULL REFERENCES circles(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  selected_by INTEGER REFERENCES users(id),
  selected_at TEXT NOT NULL,
  UNIQUE (week_id, circle_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  before TEXT,
  after TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS resource_locks (
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (resource_type, resource_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
