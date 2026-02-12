import { describe, expect, it } from 'vitest'

describe('getReportEndMs', () => {
  it('uses endTime when present', async () => {
    let mod: any = null
    try {
      mod = await import('./reportEstimation')
    } catch {
      mod = null
    }
    expect(mod?.getReportEndMs).toBeTypeOf('function')
    const r = mod.getReportEndMs({
      endTime: '2026-01-01T01:00:00.000Z',
      status: 'completed',
      includeInProgress: true,
      nowMs: 1,
      rangeEndMs: 2,
    })
    expect(r).toEqual({ endMs: Date.parse('2026-01-01T01:00:00.000Z'), estimated: false })
  })

  it('estimates end time for in-progress when enabled', async () => {
    let mod: any = null
    try {
      mod = await import('./reportEstimation')
    } catch {
      mod = null
    }
    expect(mod?.getReportEndMs).toBeTypeOf('function')
    const r = mod.getReportEndMs({
      endTime: undefined,
      status: 'in-progress',
      includeInProgress: true,
      nowMs: 1000,
      rangeEndMs: 900,
    })
    expect(r).toEqual({ endMs: 900, estimated: true })
  })
})

