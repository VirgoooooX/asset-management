import { describe, expect, it, vi } from 'vitest'
import { createRateLimiter } from './rateLimit'

describe('createRateLimiter', () => {
  it('blocks requests exceeding max within window when not in test env', () => {
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const limiter = createRateLimiter({ windowMs: 60_000, max: 2, keyPrefix: 'test' })
      const req: any = { ip: '10.0.0.1' }
      const makeRes = () => {
        const res: any = {
          statusCode: 200,
          headers: {} as Record<string, string>,
          body: null as any,
          setHeader: (k: string, v: string) => {
            res.headers[k] = v
          },
          status: (code: number) => {
            res.statusCode = code
            return res
          },
          json: (b: any) => {
            res.body = b
            return res
          },
        }
        return res
      }

      const next = vi.fn()
      limiter(req, makeRes(), next)
      limiter(req, makeRes(), next)
      expect(next).toHaveBeenCalledTimes(2)

      const res3 = makeRes()
      limiter(req, res3, next)
      expect(next).toHaveBeenCalledTimes(2)
      expect(res3.statusCode).toBe(429)
      expect(res3.body).toEqual({ error: 'rate_limited' })
      expect(res3.headers['Retry-After']).toBeDefined()
    } finally {
      process.env.NODE_ENV = origEnv
    }
  })
})
