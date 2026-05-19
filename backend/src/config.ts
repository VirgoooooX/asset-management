import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().optional(),
  DATA_DIR: z.string().optional(),
  FRONTEND_DIST_DIR: z.string().optional(),
  JWT_SECRET: z.string().min(16),
  CORS_ORIGIN: z.string().optional(),
  ADMIN_SEED_USER: z.string().optional(),
  ADMIN_SEED_PASSWORD: z.string().optional(),
  ADMIN_SEED_RESET_PASSWORD: z.string().optional(),
  COOKIE_SECURE: z.string().optional(),
  EMAIL_ENABLED: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  NOTIFICATION_SCAN_INTERVAL_SECONDS: z.coerce.number().int().positive().optional()
})

const env = envSchema.parse(process.env)

export const config = {
  port: env.PORT ?? 8080,
  dataDir: path.resolve(env.DATA_DIR ?? './data'),
  dbPath: path.resolve(env.DATA_DIR ?? './data', 'db.sqlite'),
  filesDir: path.resolve(env.DATA_DIR ?? './data', 'files'),
  frontendDistDir: env.FRONTEND_DIST_DIR ? path.resolve(env.FRONTEND_DIST_DIR) : undefined,
  jwtSecret: env.JWT_SECRET,
  corsOrigin: env.CORS_ORIGIN,
  adminSeedUser: env.ADMIN_SEED_USER ?? 'admin',
  adminSeedPassword: env.ADMIN_SEED_PASSWORD,
  adminSeedResetPassword: env.ADMIN_SEED_RESET_PASSWORD === 'true',
  cookieSecure: env.COOKIE_SECURE === 'true',
  email: {
    enabled: env.EMAIL_ENABLED === 'true',
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM
  },
  notificationScanIntervalSeconds: env.NOTIFICATION_SCAN_INTERVAL_SECONDS ?? 15 * 60
}
