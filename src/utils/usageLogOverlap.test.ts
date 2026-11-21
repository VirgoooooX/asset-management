import { describe, expect, it } from 'vitest'
import type { UsageLog } from '../types'
import { findUsageLogConflict, parseUsageLogConflictApiError } from './usageLogOverlap'

const makeLog = (overrides: Partial<UsageLog>): UsageLog => ({
  id: 'log-1',
  chamberId: 'chamber-1',
  user: 'alice',
  startTime: '2026-11-19T08:00:00.000Z',
  endTime: '2026-11-20T08:00:00.000Z',
  status: 'completed',
  createdAt: '2026-11-19T08:00:00.000Z',
  ...overrides,
})

describe('usageLogOverlap', () => {
  it('blocks strictly overlapping intervals on the same chamber', () => {
    const existing = [makeLog({ id: 'a' })]
    const conflict = findUsageLogConflict({
      logs: existing,
      chamberId: 'chamber-1',
      startTime: '2026-11-20T04:00:00.000Z',
      endTime: '2026-11-21T04:00:00.000Z',
      status: 'completed',
      nowMs: Date.parse('2026-11-21T00:00:00.000Z'),
    })
    expect(conflict?.reason).toBe('overlap')
    expect(conflict?.conflictLog.id).toBe('a')
  })

  it('allows exact back-to-back scheduling (endA === startB)', () => {
    const existing = [makeLog({ id: 'a' })]
    const conflict = findUsageLogConflict({
      logs: existing,
      chamberId: 'chamber-1',
      startTime: '2026-11-20T08:00:00.000Z',
      endTime: '2026-11-21T08:00:00.000Z',
      status: 'completed',
      nowMs: Date.parse('2026-11-21T00:00:00.000Z'),
    })
    expect(conflict).toBeNull()
  })

  it('ignores logs on other chambers and excludes self when editing', () => {
    const existing = [
      makeLog({ id: 'a', chamberId: 'chamber-1' }),
      makeLog({ id: 'b', chamberId: 'chamber-2' }),
    ]
    expect(
      findUsageLogConflict({
        logs: existing,
        chamberId: 'chamber-1',
        startTime: '2026-11-19T10:00:00.000Z',
        endTime: '2026-11-20T06:00:00.000Z',
        status: 'completed',
        excludeLogId: 'a',
        nowMs: Date.parse('2026-11-21T00:00:00.000Z'),
      })
    ).toBeNull()
  })

  it('blocks starting a new test while an earlier unfinished/overdue test is still occupying the chamber', () => {
    const existing = [
      makeLog({
        id: 'overdue-1',
        startTime: '2026-11-18T08:00:00.000Z',
        endTime: '2026-11-19T08:00:00.000Z',
        status: 'in-progress',
      }),
    ]
    const conflict = findUsageLogConflict({
      logs: existing,
      chamberId: 'chamber-1',
      startTime: '2026-11-21T08:00:00.000Z',
      endTime: '2026-11-22T08:00:00.000Z',
      status: 'in-progress',
      nowMs: Date.parse('2026-11-21T08:00:00.000Z'),
    })
    expect(conflict?.reason).toBe('active-unfinished')

    // Future planned schedule (not-started, start > now) after planned end is still allowed
    const futurePlan = findUsageLogConflict({
      logs: existing,
      chamberId: 'chamber-1',
      startTime: '2026-11-25T08:00:00.000Z',
      endTime: '2026-11-26T08:00:00.000Z',
      status: 'not-started',
      nowMs: Date.parse('2026-11-21T08:00:00.000Z'),
    })
    expect(futurePlan).toBeNull()
  })

  it('parses structured backend 409 conflict JSON errors', () => {
    const tr = (zh: string) => zh
    const msg = parseUsageLogConflictApiError(
      JSON.stringify({
        error: 'usage_log_overlap',
        conflict: {
          id: 'c1',
          startTime: '2026-11-19T08:00:00.000Z',
          endTime: '2026-11-20T08:00:00.000Z',
          user: 'alice',
          status: 'completed',
        },
      }),
      tr
    )
    expect(msg).toContain('时间重叠')
    expect(msg).toContain('alice')
  })
})
