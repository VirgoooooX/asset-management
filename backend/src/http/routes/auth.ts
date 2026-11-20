import { Router, type Response } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import type Database from 'better-sqlite3'
import { randomToken, sha256Hex } from '../../util/crypto.js'
import { hashPassword, verifyPassword } from '../../util/password.js'
import { getDb } from '../../db/db.js'
import { config } from '../../config.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { asyncHandler } from '../middlewares/asyncHandler.js'
import { createRateLimiter } from '../middlewares/rateLimit.js'
import { validateBody } from '../middlewares/validate.js'

export const authRouter = Router()

const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'auth_login' })
const signupLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: 'auth_signup' })
const refreshLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60, keyPrefix: 'auth_refresh' })

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const signUpSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
})

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000
const ACCESS_TTL_MS = 15 * 60 * 1000

const cookieBaseOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.cookieSecure,
  path: '/api',
}

const clearAuthCookies = (res: Response) => {
  res.clearCookie('refresh_token', cookieBaseOptions)
  res.clearCookie('access_token', cookieBaseOptions)
}

const issueSession = (
  db: Database.Database,
  res: Response,
  user: { id: string; username: string; role: string },
  opts?: { replaceSessionId?: string; pruneExpired?: boolean; nowIso?: string }
) => {
  const nowIso = opts?.nowIso ?? new Date().toISOString()
  const refreshToken = randomToken(32)
  const refreshHash = sha256Hex(refreshToken)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString()

  db.transaction(() => {
    if (opts?.pruneExpired) {
      db.prepare('delete from auth_sessions where expires_at <= ?').run(nowIso)
    }
    if (opts?.replaceSessionId) {
      db.prepare('delete from auth_sessions where id = ?').run(opts.replaceSessionId)
    }
    db.prepare(
      'insert into auth_sessions (id, user_id, refresh_token_hash, created_at, expires_at) values (?, ?, ?, ?, ?)'
    ).run(randomToken(16), user.id, refreshHash, nowIso, expiresAt)
  })()

  const accessToken = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: '15m', algorithm: 'HS256' }
  )

  res.cookie('refresh_token', refreshToken, { ...cookieBaseOptions, maxAge: REFRESH_TTL_MS })
  res.cookie('access_token', accessToken, { ...cookieBaseOptions, maxAge: ACCESS_TTL_MS })
  return accessToken
}

authRouter.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as z.infer<typeof loginSchema>

    const db = getDb()
    const user = db
      .prepare('select id, username, password_hash, role, status from users where username = ?')
      .get(username) as { id: string; username: string; password_hash: string; role: string; status?: string } | undefined
    if (!user) return res.status(401).json({ error: 'invalid_credentials' })
    const verified = await verifyPassword(password, user.password_hash)
    if (!verified.ok) return res.status(401).json({ error: 'invalid_credentials' })
    const status = typeof user.status === 'string' ? user.status : 'active'
    if (status !== 'active') {
      return res.status(403).json({ error: status === 'pending' ? 'user_pending' : 'user_disabled' })
    }

    const nowIso = new Date().toISOString()
    if (verified.needsRehash) {
      const newHash = await hashPassword(password)
      db.prepare('update users set password_hash = ?, updated_at = ? where id = ?').run(newHash, nowIso, user.id)
    }

    const accessToken = issueSession(db, res, user, { pruneExpired: true, nowIso })
    res.json({
      accessToken,
      user: { id: user.id, username: user.username, role: user.role },
    })
  })
)

authRouter.post(
  '/signup',
  signupLimiter,
  validateBody(signUpSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as z.infer<typeof signUpSchema>

    const db = getDb()
    const exists = db.prepare('select 1 as ok from users where username = ?').get(username) as { ok: 1 } | undefined
    if (exists?.ok === 1) return res.status(400).json({ error: 'username_taken' })

    const id = randomToken(16)
    const hash = await hashPassword(password)
    const now = new Date().toISOString()
    try {
      db.prepare(
        'insert into users (id, username, password_hash, role, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, username, hash, 'user', 'pending', now, now)
    } catch (e: unknown) {
      const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: unknown }).code : undefined
      if (code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: 'username_taken' })
      throw e
    }

    res.json({ pending: true })
  })
)

authRouter.post('/logout', (req, res) => {
  const token = typeof req.cookies?.refresh_token === 'string' ? (req.cookies.refresh_token as string) : undefined
  if (token) {
    const db = getDb()
    db.prepare('delete from auth_sessions where refresh_token_hash = ?').run(sha256Hex(token))
  }
  clearAuthCookies(res)
  res.json({ ok: true })
})

authRouter.post('/refresh', refreshLimiter, (req, res) => {
  const token = typeof req.cookies?.refresh_token === 'string' ? (req.cookies.refresh_token as string) : undefined
  if (!token) return res.status(401).json({ error: 'missing_refresh_token' })
  const db = getDb()
  const session = db
    .prepare('select id, user_id, expires_at from auth_sessions where refresh_token_hash = ?')
    .get(sha256Hex(token)) as { id: string; user_id: string; expires_at: string } | undefined
  if (!session) return res.status(401).json({ error: 'invalid_refresh_token' })
  if (Date.parse(session.expires_at) <= Date.now()) {
    db.prepare('delete from auth_sessions where id = ?').run(session.id)
    return res.status(401).json({ error: 'refresh_token_expired' })
  }

  const user = db
    .prepare('select id, username, role, status from users where id = ?')
    .get(session.user_id) as { id: string; username: string; role: string; status?: string } | undefined
  if (!user) return res.status(401).json({ error: 'invalid_refresh_token' })
  const status = typeof user.status === 'string' ? user.status : 'active'
  if (status !== 'active') {
    db.prepare('delete from auth_sessions where id = ?').run(session.id)
    clearAuthCookies(res)
    return res.status(403).json({ error: status === 'pending' ? 'user_pending' : 'user_disabled' })
  }

  const accessToken = issueSession(db, res, user, { replaceSessionId: session.id })
  res.json({ accessToken, user: { id: user.id, username: user.username, role: user.role } })
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})
