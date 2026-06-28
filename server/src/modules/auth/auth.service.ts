import bcrypt from 'bcryptjs';
import { db, tx } from '../../db';
import { env } from '../../config/env';
import { addDaysIso, nowIso, token } from '../../utils/time';
import { Errors } from '../../utils/errors';
import { writeAudit } from '../../core/audit';
import type { Permission, Role, SessionUser } from '@quran/shared';

const selUserByUsername = db.prepare(
  `SELECT id, name, username, password_hash, role, is_active FROM users WHERE username = ?`,
);
const selUserById = db.prepare(
  `SELECT id, name, username, role, is_active FROM users WHERE id = ?`,
);
const selPerms = db.prepare(`SELECT permission FROM user_permissions WHERE user_id = ?`);
const selCircles = db.prepare(`SELECT circle_id FROM user_circles WHERE user_id = ?`);

const insSession = db.prepare(
  `INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
);
const selSession = db.prepare(`SELECT id, user_id, expires_at FROM sessions WHERE id = ?`);
const delSession = db.prepare(`DELETE FROM sessions WHERE id = ?`);

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function buildSessionUser(id: number, name: string, username: string, role: Role): SessionUser {
  const permissions = (selPerms.all(id) as { permission: string }[]).map((r) => r.permission as Permission);
  const circleIds = (selCircles.all(id) as { circle_id: number }[]).map((r) => r.circle_id);
  return { id, name, username, role, permissions, circleIds };
}

export function login(username: string, password: string): { sessionId: string; user: SessionUser } {
  const row = selUserByUsername.get(username) as
    | { id: number; name: string; username: string; password_hash: string; role: Role; is_active: number }
    | undefined;
  if (!row || !row.is_active || !bcrypt.compareSync(password, row.password_hash)) {
    throw new AppErrorInvalidCreds();
  }
  const sessionId = token();
  insSession.run(sessionId, row.id, nowIso(), addDaysIso(env.sessionTtlDays));
  writeAudit({ userId: row.id, action: 'login', entity: 'session', entityId: row.id });
  return { sessionId, user: buildSessionUser(row.id, row.name, row.username, row.role) };
}

class AppErrorInvalidCreds extends Error {
  status = 401;
  code = 'invalid_credentials';
  constructor() {
    super('اسم المستخدم أو كلمة المرور غير صحيحة');
  }
}

export function logout(sessionId: string): void {
  delSession.run(sessionId);
}

/** يحمّل المستخدم من معرّف الجلسة أو يُرجع null */
export function loadSessionUser(sessionId: string | undefined): { user: SessionUser; sessionId: string } | null {
  if (!sessionId) return null;
  const s = selSession.get(sessionId) as { id: string; user_id: number; expires_at: string } | undefined;
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) {
    delSession.run(sessionId);
    return null;
  }
  const u = selUserById.get(s.user_id) as
    | { id: number; name: string; username: string; role: Role; is_active: number }
    | undefined;
  if (!u || !u.is_active) {
    delSession.run(sessionId);
    return null;
  }
  return { user: buildSessionUser(u.id, u.name, u.username, u.role), sessionId };
}

export function changePassword(userId: number, currentPassword: string, newPassword: string): void {
  const row = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId) as
    | { password_hash: string }
    | undefined;
  if (!row || !bcrypt.compareSync(currentPassword, row.password_hash)) {
    throw Errors.badRequest('كلمة المرور الحالية غير صحيحة');
  }
  tx(() => {
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(newPassword), userId);
    writeAudit({ userId, action: 'change_password', entity: 'user', entityId: userId });
  });
}
