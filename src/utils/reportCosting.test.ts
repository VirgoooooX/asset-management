import { describe, expect, it } from 'vitest'

describe('getEffectiveHourlyRateCents', () => {
  it('prefers usage log snapshot rate when present', async () => {
    let mod: any = null
    try {
      mod = await import('./reportCosting')
    } catch {
      mod = null
    }
    expect(mod?.getEffectiveHourlyRateCents).toBeTypeOf('function')
    const r = mod.getEffectiveHourlyRateCents({
      usageLog: { hourlyRateCentsSnapshot: 500 },
      assetHourlyRateCents: 100,
    })
    expect(r).toEqual({ hourlyRateCents: 500, source: 'snapshot' })
  })

  it('falls back to asset rate when snapshot missing', async () => {
    let mod: any = null
    try {
      mod = await import('./reportCosting')
    } catch {
      mod = null
    }
    expect(mod?.getEffectiveHourlyRateCents).toBeTypeOf('function')
    const r = mod.getEffectiveHourlyRateCents({
      usageLog: {},
      assetHourlyRateCents: 1200,
    })
    expect(r).toEqual({ hourlyRateCents: 1200, source: 'asset' })
  })
})

