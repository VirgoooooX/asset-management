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
  TRUST_PROXY: z.string().optional()
})

const env = envSchema.parse(process.env)

const parseTrustProxy = (raw?: string): boolean | number | string | undefined => {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  const num = Number(trimmed)
  if (Number.isInteger(num) && num >= 0) return num
  return trimmed
}

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
  trustProxy: parseTrustProxy(env.TRUST_PROXY)
}
