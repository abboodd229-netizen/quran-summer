import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.isProd ? 'info' : 'debug',
  base: undefined,
});
