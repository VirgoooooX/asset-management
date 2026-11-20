import { RequestHandler } from 'express'

type Bucket = {
  count: number
  resetAt: number
}

export type RateLimitOptions = {
  windowMs: number
  max: number
  keyPrefix: string
}

export const createRateLimiter = (options: RateLimitOptions): RequestHandler => {
  const buckets = new Map<string, Bucket>()

  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  }, Math.max(30_000, Math.min(options.windowMs, 5 * 60 * 1000)))
  cleanupInterval.unref()

  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') {
      next()
      return
    }

    const now = Date.now()
    const ip = req.ip || 'unknown'
    const key = `${options.keyPrefix}:${ip}`
    const existing = buckets.get(key)

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs })
      next()
      return
    }

    if (existing.count >= options.max) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfterSec))
      res.status(429).json({ error: 'rate_limited' })
      return
    }

    existing.count += 1
    next()
  }
}
