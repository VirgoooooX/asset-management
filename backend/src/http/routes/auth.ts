import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomToken, sha256Hex } from '../../util/crypto.js'
import { getDb } from '../../db/db.js'
import { config } from '../../config.js'
import jwt from 'jsonwebtoken'
import { requireAuth } from '../middlewares/requireAuth.js'

export const authRouter = Router()

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

const signUpSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8)
})

const issueAccessToken = (user: { id: string; username: string; role: string }) => {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: '15m' }
  )
}

const setAccessCookie = (res: any, token: string) => {
  res.cookie('access_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/api',
    maxAge: 15 * 60 * 1000
  })
}

const setRefreshCookie = (res: any, token: string) => {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/api',
    maxAge: 30 * 24 * 60 * 60 * 1000
  })
}

authRouter.post('/login', async (req, res) => {
  const body = loginSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const { username, password } = body.data

  const db = getDb()
  const user = db
    .prepare('select id, username, password_hash, role, status from users where username = ?')
    .get(username) as { id: string; username: string; password_hash: string; role: string; status?: string } | undefined
  if (!user) return res.status(401).json({ error: 'invalid_credentials' })
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
  const status = typeof user.status === 'string' ? user.status : 'active'
  if (status !== 'active') {
    return res.status(403).json({ error: status === 'pending' ? 'user_pending' : 'user_disabled' })
  }

  const refreshToken = randomToken(32)
  const refreshHash = sha256Hex(refreshToken)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  db.prepare(
    'insert into auth_sessions (id, user_id, refresh_token_hash, created_at, expires_at) values (?, ?, ?, ?, ?)'
  ).run(randomToken(16), user.id, refreshHash, new Date().toISOString(), expiresAt)

  setRefreshCookie(res, refreshToken)

  const accessToken = issueAccessToken(user)
  setAccessCookie(res, accessToken)
  res.json({
    accessToken,
    user: { id: user.id, username: user.username, role: user.role }
  })
})

authRouter.post('/signup', async (req, res) => {
  const body = signUpSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const { username, password } = body.data

  const db = getDb()
  const exists = db.prepare('select 1 as ok from users where username = ?').get(username) as { ok: 1 } | undefined
  if (exists?.ok === 1) return res.status(400).json({ error: 'username_taken' })

  const id = randomToken(16)
  const hash = await bcrypt.hash(password, 12)
  const now = new Date().toISOString()
  db.prepare(
    'insert into users (id, username, password_hash, role, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, username, hash, 'user', 'pending', now, now)

  res.json({ pending: true })
})

authRouter.post('/logout', (req, res) => {
  const token = typeof req.cookies?.refresh_token === 'string' ? (req.cookies.refresh_token as string) : undefined
  if (token) {
    const db = getDb()
    db.prepare('delete from auth_sessions where refresh_token_hash = ?').run(sha256Hex(token))
  }
  res.clearCookie('refresh_token', { path: '/api' })
  res.clearCookie('access_token', { path: '/api' })
  res.json({ ok: true })
})

authRouter.post('/refresh', (req, res) => {
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
    res.clearCookie('refresh_token', { path: '/api' })
    res.clearCookie('access_token', { path: '/api' })
    return res.status(403).json({ error: status === 'pending' ? 'user_pending' : 'user_disabled' })
  }

  db.prepare('delete from auth_sessions where id = ?').run(session.id)
  const newRefreshToken = randomToken(32)
  const newRefreshHash = sha256Hex(newRefreshToken)
  const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  db.prepare(
    'insert into auth_sessions (id, user_id, refresh_token_hash, created_at, expires_at) values (?, ?, ?, ?, ?)'
  ).run(randomToken(16), user.id, newRefreshHash, new Date().toISOString(), newExpiresAt)
  setRefreshCookie(res, newRefreshToken)

  const accessToken = issueAccessToken(user)
  setAccessCookie(res, accessToken)
  res.json({ accessToken, user })
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})
