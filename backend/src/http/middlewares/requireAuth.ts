import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../../config.js'

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; role: 'admin' | 'user' }
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return res.status(401).json({ error: 'missing_access_token' })
  const token = match[1]
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any
    const role = decoded?.role === 'admin' ? 'admin' : 'user'
    req.user = { id: String(decoded.sub), username: String(decoded.username ?? ''), role }
    return next()
  } catch {
    return res.status(401).json({ error: 'invalid_access_token' })
  }
}

