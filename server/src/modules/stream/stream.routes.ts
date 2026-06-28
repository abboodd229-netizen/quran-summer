import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { addClient } from '../../core/sse';

export const streamRouter = Router();

streamRouter.get('/', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  const remove = addClient(res);
  req.on('close', remove);
});
