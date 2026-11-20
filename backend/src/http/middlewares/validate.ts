import type { NextFunction, Request, Response } from 'express'
import type { ZodTypeAny, z } from 'zod'

declare global {
  namespace Express {
    interface Request {
      validatedQuery?: unknown
    }
  }
}

export const validateBody = <S extends ZodTypeAny>(schema: S, errorCode = 'invalid_body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: errorCode })
    }
    req.body = parsed.data as z.infer<S>
    return next()
  }
}

export const validateQuery = <S extends ZodTypeAny>(schema: S, errorCode = 'invalid_query') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: errorCode })
    }
    req.validatedQuery = parsed.data as z.infer<S>
    return next()
  }
}
