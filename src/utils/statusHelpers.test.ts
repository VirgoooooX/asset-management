import { describe, it, expect } from 'vitest'
import { getEffectiveUsageLogStatus, isUsageLogCurrentlyActive, isUsageLogOccupyingAsset } from './statusHelpers'
import type { UsageLog } from '../types'

const baseLog = (overrides: Partial<UsageLog>): UsageLog => ({
  id: '1',
  chamberId: 'c1',
  startTime: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  user: 'u',
  status: 'not-started',
  createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  ...overrides,
})

describe('statusHelpers', () => {
  it('returns completed when stored status is completed', () => {
    const log = baseLog({ status: 'completed', endTime: undefined })
    expect(getEffectiveUsageLogStatus(log, new Date('2026-01-01T00:00:00.000Z'))).toBe('completed')
  })

  it('returns overdue when endTime is before now and not completed', () => {
    const log = baseLog({
      status: 'in-progress',
      startTime: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      endTime: new Date('2026-01-01T01:00:00.000Z').toISOString(),
    })
    expect(getEffectiveUsageLogStatus(log, new Date('2026-01-01T02:00:00.000Z'))).toBe('overdue')
  })

  it('returns in-progress when started and not ended', () => {
    const log = baseLog({
      status: 'not-started',
      startTime: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      endTime: new Date('2026-01-01T02:00:00.000Z').toISOString(),
    })
    expect(getEffectiveUsageLogStatus(log, new Date('2026-01-01T01:00:00.000Z'))).toBe('in-progress')
  })

  it('treats currently active as in-progress within time window', () => {
    const log = baseLog({
      status: 'in-progress',
      startTime: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      endTime: new Date('2026-01-01T02:00:00.000Z').toISOString(),
    })
    expect(isUsageLogCurrentlyActive(log, new Date('2026-01-01T01:00:00.000Z'))).toBe(true)
    expect(isUsageLogCurrentlyActive(log, new Date('2026-01-01T03:00:00.000Z'))).toBe(false)
  })

  it('treats occupying asset when started and not ended, regardless stored status', () => {
    const log = baseLog({
      status: 'not-started',
      startTime: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      endTime: new Date('2026-01-01T02:00:00.000Z').toISOString(),
    })
    expect(isUsageLogOccupyingAsset(log, new Date('2026-01-01T01:00:00.000Z'))).toBe(true)
    expect(isUsageLogOccupyingAsset(log, new Date('2026-01-01T03:00:00.000Z'))).toBe(false)
  })
})
