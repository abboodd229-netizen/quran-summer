import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env';
import { logger } from './config/logger';
import { attachUser } from './middlewares/auth';
import { errorHandler, notFound } from './middlewares/http';

import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { studentsRouter } from './modules/students/students.routes';
import { eventsRouter } from './modules/events/events.routes';
import { lotteryRouter } from './modules/lottery/lottery.routes';
import { excellenceRouter } from './modules/excellence/excellence.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { auditRouter } from './modules/audit/audit.routes';
import { locksRouter } from './modules/locks/locks.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { streamRouter } from './modules/stream/stream.routes';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: env.isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:'],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              connectSrc: ["'self'"],
            },
          }
        : false,
    }),
  );
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' || req.url === '/api/stream' } }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(attachUser);

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/', catalogRouter); // /weeks /groups /circles
  api.use('/students', studentsRouter);
  api.use('/events', eventsRouter);
  api.use('/lotteries', lotteryRouter);
  api.use('/excellence', excellenceRouter);
  api.use('/reports', reportsRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/audit', auditRouter);
  api.use('/locks', locksRouter);
  api.use('/settings', settingsRouter);
  api.use('/stream', streamRouter);
  app.use('/api', api);

  // تقديم واجهة العميل المبنية في الإنتاج
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
