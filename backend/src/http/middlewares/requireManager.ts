import { NextFunction, Request, Response } from 'express'

export const requireManager = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[auth] manager_required', {
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.id,
        role: req.user?.role
      })
    }
    return res.status(403).json({ error: 'manager_required' })
  }
  return next()
}
