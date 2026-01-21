import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../../config.js'

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; role: 'admin' | 'manager' | 'user' }
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  const cookieToken = typeof (req as any).cookies?.access_token === 'string' ? ((req as any).cookies.access_token as string) : ''
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
    const decoded = jwt.verify(token, config.jwtSecret) as any
    const role = decoded?.role === 'admin' ? 'admin' : decoded?.role === 'manager' ? 'manager' : 'user'
    req.user = { id: String(decoded.sub), username: String(decoded.username ?? ''), role }
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
