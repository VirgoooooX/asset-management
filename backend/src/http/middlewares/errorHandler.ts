import { NextFunction, Request, Response } from 'express'

export const apiNotFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found' })
}

interface HttpLikeError {
  type?: unknown
  status?: unknown
  code?: unknown
  message?: unknown
}

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return

  const e = (typeof err === 'object' && err !== null ? err : {}) as HttpLikeError

  if (e.type === 'entity.too.large' || e.status === 413) {
    res.status(413).json({ error: 'payload_too_large' })
    return
  }

  if (err instanceof SyntaxError && e.status === 400) {
    res.status(400).json({ error: 'invalid_json' })
    return
  }

  if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    res.status(409).json({ error: 'conflict' })
    return
  }

  console.error('[http] unhandled error', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    message: typeof e.message === 'string' ? e.message : String(err),
  })

  res.status(500).json({
    error: 'internal_error',
    requestId: req.requestId,
  })
}
