import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../../config.js'
import { getDb } from '../../db/db.js'

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; role: 'admin' | 'manager' | 'user' }
    }
  }
}

const normalizeRole = (role: unknown): 'admin' | 'manager' | 'user' => {
  if (role === 'admin') return 'admin'
  if (role === 'manager') return 'manager'
  return 'user'
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  const cookies = req.cookies as Record<string, unknown> | undefined
  const cookieToken = typeof cookies?.access_token === 'string' ? cookies.access_token : ''
  const token = match?.[1] ?? cookieToken
  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[auth] missing_access_token', {
        method: req.method,
        url: req.originalUrl,
        hasAuthHeader: Boolean(header),
        hasCookieToken: Boolean(cookieToken)
      })
    }
    return res.status(401).json({ error: 'missing_access_token' })
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] })
    const userId =
      typeof decoded === 'object' && decoded !== null && typeof decoded.sub === 'string' ? decoded.sub : ''
    if (!userId) return res.status(401).json({ error: 'invalid_access_token' })

    const db = getDb()
    const row = db
      .prepare('select id, username, role, status from users where id = ?')
      .get(userId) as { id: string; username: string; role: string; status?: string } | undefined
    if (!row) return res.status(401).json({ error: 'invalid_access_token' })

    const status = typeof row.status === 'string' ? row.status : 'active'
    if (status !== 'active') {
      return res.status(403).json({ error: status === 'pending' ? 'user_pending' : 'user_disabled' })
    }

    req.user = {
      id: row.id,
      username: row.username,
      role: normalizeRole(row.role),
    }
    return next()
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[auth] invalid_access_token', {
        method: req.method,
        url: req.originalUrl,
        tokenSource: match?.[1] ? 'authorization' : cookieToken ? 'cookie' : 'unknown'
      })
    }
    return res.status(401).json({ error: 'invalid_access_token' })
  }
}
