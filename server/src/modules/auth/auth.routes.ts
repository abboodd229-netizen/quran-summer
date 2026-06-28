import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { changePasswordSchema, loginSchema } from '@quran/shared';
import { asyncHandler, validateBody } from '../../middlewares/http';
import { requireAuth, SESSION_COOKIE } from '../../middlewares/auth';
import { env } from '../../config/env';
import { changePassword, login, logout } from './auth.service';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'محاولات كثيرة، حاول لاحقًا' } },
});

authRouter.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as { username: string; password: string };
    const { sessionId, user } = login(username, password);
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.isProd,
      maxAge: env.sessionTtlDays * 86_400_000,
      path: '/',
    });
    res.json({ user });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.sessionId) logout(req.sessionId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    changePassword(req.user!.id, currentPassword, newPassword);
    res.json({ ok: true });
  }),
);
