import { describe, expect, it } from 'vitest'

describe('computeCostSnapshot', () => {
  it('is implemented', async () => {
    let mod: any = null
    try {
      mod = await import('./costSnapshot')
    } catch {
      mod = null
    }
    expect(mod?.computeCostSnapshot).toBeTypeOf('function')
  })

  it('rounds up billable hours and multiplies by rate', async () => {
    let mod: any = null
    try {
      mod = await import('./costSnapshot')
    } catch {
      mod = null
    }
    expect(mod?.computeCostSnapshot).toBeTypeOf('function')
    const r = mod.computeCostSnapshot({
      startIso: '2026-01-01T00:00:00.000Z',
      endIso: '2026-01-01T01:00:01.000Z',
      hourlyRateCents: 1234,
    })
    expect(r).toEqual({ billableHours: 2, costCents: 2468 })
  })
})

