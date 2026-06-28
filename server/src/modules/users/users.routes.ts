import { Router } from 'express';
import { db, tx } from '../../db';
import { asyncHandler, validateBody } from '../../middlewares/http';
import { requireAdmin } from '../../middlewares/auth';
import { createUserSchema, updateUserSchema, type Permission } from '@quran/shared';
import { Errors } from '../../utils/errors';
import { writeAudit } from '../../core/audit';
import { hashPassword } from '../auth/auth.service';
import { nowIso } from '../../utils/time';

export const usersRouter = Router();

function userDetail(id: number) {
  const u = db
    .prepare(`SELECT id, name, username, role, is_active AS isActive, created_at AS createdAt FROM users WHERE id = ?`)
    .get(id) as
    | { id: number; name: string; username: string; role: string; isActive: number; createdAt: string }
    | undefined;
  if (!u) return null;
  const permissions = (db.prepare(`SELECT permission FROM user_permissions WHERE user_id = ?`).all(id) as {
    permission: string;
  }[]).map((r) => r.permission);
  const circleIds = (db.prepare(`SELECT circle_id AS c FROM user_circles WHERE user_id = ?`).all(id) as {
    c: number;
  }[]).map((r) => r.c);
  return { ...u, isActive: !!u.isActive, permissions, circleIds };
}

usersRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.username, u.role, u.is_active AS isActive, u.created_at AS createdAt,
                (SELECT COUNT(*) FROM user_circles uc WHERE uc.user_id = u.id) AS circleCount
         FROM users u ORDER BY u.role, u.name`,
      )
      .all();
    res.json({ users: rows });
  }),
);

usersRouter.get(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const u = userDetail(Number(req.params.id));
    if (!u) throw Errors.notFound('المستخدم غير موجود');
    res.json({ user: u });
  }),
);

usersRouter.post(
  '/',
  requireAdmin,
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as {
      name: string; username: string; password: string; role: 'admin' | 'assistant';
      circleIds: number[]; permissions: Permission[];
    };
    const exists = db.prepare(`SELECT id FROM users WHERE username = ?`).get(b.username);
    if (exists) throw Errors.badRequest('اسم المستخدم مستخدم بالفعل');
    const id = tx(() => {
      const r = db
        .prepare(`INSERT INTO users (name, username, password_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)`)
        .run(b.name, b.username, hashPassword(b.password), b.role, nowIso());
      const uid = Number(r.lastInsertRowid);
      if (b.role === 'assistant') {
        const insC = db.prepare(`INSERT OR IGNORE INTO user_circles (user_id, circle_id) VALUES (?, ?)`);
        for (const c of b.circleIds) insC.run(uid, c);
        const insP = db.prepare(`INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)`);
        for (const p of b.permissions) insP.run(uid, p);
      }
      writeAudit({ userId: req.user!.id, action: 'create', entity: 'user', entityId: uid, after: { name: b.name, username: b.username, role: b.role } });
      return uid;
    });
    res.status(201).json({ user: userDetail(id) });
  }),
);

usersRouter.patch(
  '/:id',
  requireAdmin,
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(id) as { id: number; role: string } | undefined;
    if (!target) throw Errors.notFound('المستخدم غير موجود');
    const b = req.body as {
      name?: string; password?: string; isActive?: boolean; circleIds?: number[]; permissions?: Permission[];
    };
    tx(() => {
      if (b.name != null) db.prepare(`UPDATE users SET name = ? WHERE id = ?`).run(b.name, id);
      if (b.password) db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(b.password), id);
      if (b.isActive != null) {
        db.prepare(`UPDATE users SET is_active = ? WHERE id = ?`).run(b.isActive ? 1 : 0, id);
        if (!b.isActive) db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(id); // إنهاء الجلسات فورًا
      }
      if (b.circleIds && target.role === 'assistant') {
        db.prepare(`DELETE FROM user_circles WHERE user_id = ?`).run(id);
        const insC = db.prepare(`INSERT OR IGNORE INTO user_circles (user_id, circle_id) VALUES (?, ?)`);
        for (const c of b.circleIds) insC.run(id, c);
      }
      if (b.permissions && target.role === 'assistant') {
        db.prepare(`DELETE FROM user_permissions WHERE user_id = ?`).run(id);
        const insP = db.prepare(`INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)`);
        for (const p of b.permissions) insP.run(id, p);
      }
      writeAudit({ userId: req.user!.id, action: 'update', entity: 'user', entityId: id, after: b });
    });
    res.json({ user: userDetail(id) });
  }),
);
