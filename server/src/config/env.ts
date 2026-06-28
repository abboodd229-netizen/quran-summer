import path from 'node:path';

function bool(v: string | undefined, def: boolean): boolean {
  if (v === undefined) return def;
  return v === 'true' || v === '1';
}

const dataPathRaw = process.env.DATABASE_PATH ?? './data/app.sqlite';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
  port: Number(process.env.PORT ?? 8080),
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-insecure-secret-change-me',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
  databasePath: path.isAbsolute(dataPathRaw)
    ? dataPathRaw
    : path.resolve(process.cwd(), dataPathRaw),
  admin: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'Admin@12345',
    name: process.env.ADMIN_NAME ?? 'مدير النظام',
  },
  backup: {
    enabled: bool(process.env.BACKUP_ENABLED, true),
    keep: Number(process.env.BACKUP_KEEP ?? 14),
  },
};
