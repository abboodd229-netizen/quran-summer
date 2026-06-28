import { Router } from 'express';
import { db } from '../../db';
import { asyncHandler } from '../../middlewares/http';
import { requireAuth, requirePermission } from '../../middlewares/auth';
import type { AuditLog } from '@quran/shared';

export const auditRouter = Router();

auditRouter.get(
  '/',
  requireAuth,
  requirePermission('view_audit'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const conds: string[] = [];
    const args: unknown[] = [];
    if (req.query.userId) { conds.push('a.user_id = ?'); args.push(Number(req.query.userId)); }
    if (req.query.action) { conds.push('a.action = ?'); args.push(String(req.query.action)); }
    if (req.query.entity) { conds.push('a.entity = ?'); args.push(String(req.query.entity)); }
    if (req.query.from) { conds.push('a.created_at >= ?'); args.push(String(req.query.from)); }
    if (req.query.to) { conds.push('a.created_at <= ?'); args.push(String(req.query.to)); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT a.id, a.user_id AS userId, u.name AS userName, a.action, a.entity,
                a.entity_id AS entityId, a.before, a.after, a.created_at AS createdAt
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
         ${where} ORDER BY a.id DESC LIMIT ?`,
      )
      .all(...args, limit) as (Omit<AuditLog, 'before' | 'after'> & { before: string | null; after: string | null })[];
    const logs: AuditLog[] = rows.map((r) => ({
      ...r,
      before: r.before ? JSON.parse(r.before) : null,
      after: r.after ? JSON.parse(r.after) : null,
    }));
    res.json({ logs });
  }),
);
