import { NextFunction, Request, Response } from 'express'
import { randomToken } from '../../util/crypto.js'

declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}

export const attachRequestId = (req: Request, res: Response, next: NextFunction) => {
  const header = typeof req.headers['x-request-id'] === 'string' ? (req.headers['x-request-id'] as string) : ''
  const raw = header.trim()
  const requestId = raw && raw.length <= 64 ? raw : randomToken(12)
  req.requestId = requestId
  res.setHeader('x-request-id', requestId)
  next()
}

