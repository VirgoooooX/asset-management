import { describe, expect, it } from 'vitest'

import { buildDailySeries, computeCostLines, groupCostLines } from './projectCostReport'

describe('projectCostReport', () => {
  it('computes cost lines with snapshot rate fallback', () => {
    const { lines } = computeCostLines({
      usageLogs: [
        {
          id: 'u1',
          chamberId: 'c1',
          projectId: 'p1',
          startTime: '2026-01-01T00:00:00.000Z',
          endTime: '2026-01-01T01:00:00.000Z',
          user: 'alice',
          status: 'completed',
          hourlyRateCentsSnapshot: 500,
          createdAt: '2026-01-01T00:00:00.000Z',
        } as any,
        {
          id: 'u2',
          chamberId: 'c1',
          projectId: 'p1',
          startTime: '2026-01-02T00:00:00.000Z',
          endTime: '2026-01-02T01:00:00.000Z',
          user: 'bob',
          status: 'completed',
          createdAt: '2026-01-02T00:00:00.000Z',
        } as any,
      ],
      assetsById: new Map([['c1', { id: 'c1', name: 'C-01', hourlyRateCents: 1200, category: 'A' } as any]]),
      projectsById: new Map([['p1', { id: 'p1', name: 'P-01' } as any]]),
      rangeStartMs: Date.parse('2026-01-01T00:00:00.000Z'),
      rangeEndMs: Date.parse('2026-01-03T00:00:00.000Z'),
      projectId: 'all',
      includeUnlinked: true,
      includeInProgress: false,
      nowMs: Date.parse('2026-01-03T00:00:00.000Z'),
      unlinkedLabel: 'Unlinked',
      uncategorizedLabel: 'Uncategorized',
    })

    expect(lines).toHaveLength(2)
    const u1 = lines.find((l) => l.logId === 'u1')!
    const u2 = lines.find((l) => l.logId === 'u2')!
    expect(u1.hourlyRateCents).toBe(500)
    expect(u1.rateSource).toBe('snapshot')
    expect(u2.hourlyRateCents).toBe(1200)
    expect(u2.rateSource).toBe('asset')
  })

  it('groups by project with totals', () => {
    const { lines } = computeCostLines({
      usageLogs: [
        {
          id: 'u1',
          chamberId: 'c1',
          projectId: 'p1',
          startTime: '2026-01-01T00:00:00.000Z',
          endTime: '2026-01-01T02:00:00.000Z',
          user: 'alice',
          status: 'completed',
          hourlyRateCentsSnapshot: 100,
          createdAt: '2026-01-01T00:00:00.000Z',
        } as any,
        {
          id: 'u2',
          chamberId: 'c1',
          projectId: 'p2',
          startTime: '2026-01-01T00:00:00.000Z',
          endTime: '2026-01-01T01:00:00.000Z',
          user: 'alice',
          status: 'completed',
          hourlyRateCentsSnapshot: 200,
          createdAt: '2026-01-01T00:00:00.000Z',
        } as any,
      ],
      assetsById: new Map([['c1', { id: 'c1', name: 'C-01', hourlyRateCents: 0, category: 'A' } as any]]),
      projectsById: new Map([
        ['p1', { id: 'p1', name: 'P-01' } as any],
        ['p2', { id: 'p2', name: 'P-02' } as any],
      ]),
      rangeStartMs: Date.parse('2026-01-01T00:00:00.000Z'),
      rangeEndMs: Date.parse('2026-01-02T00:00:00.000Z'),
      projectId: 'all',
      includeUnlinked: true,
      includeInProgress: false,
      nowMs: Date.parse('2026-01-02T00:00:00.000Z'),
      unlinkedLabel: 'Unlinked',
      uncategorizedLabel: 'Uncategorized',
    })

    const groups = groupCostLines(lines, 'project')
    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.key === 'p1')?.costCents).toBe(200)
    expect(groups.find((g) => g.key === 'p2')?.costCents).toBe(200)
  })

  it('builds daily series with zero-fill', () => {
    const { lines } = computeCostLines({
      usageLogs: [
        {
          id: 'u1',
          chamberId: 'c1',
          projectId: 'p1',
          startTime: '2026-01-01T00:00:00.000Z',
          endTime: '2026-01-01T01:00:00.000Z',
          user: 'alice',
          status: 'completed',
          hourlyRateCentsSnapshot: 100,
          createdAt: '2026-01-01T00:00:00.000Z',
        } as any,
      ],
      assetsById: new Map([['c1', { id: 'c1', name: 'C-01', hourlyRateCents: 0, category: 'A' } as any]]),
      projectsById: new Map([['p1', { id: 'p1', name: 'P-01' } as any]]),
      rangeStartMs: Date.parse('2026-01-01T00:00:00.000Z'),
      rangeEndMs: Date.parse('2026-01-03T00:00:00.000Z'),
      projectId: 'all',
      includeUnlinked: true,
      includeInProgress: false,
      nowMs: Date.parse('2026-01-03T00:00:00.000Z'),
      unlinkedLabel: 'Unlinked',
      uncategorizedLabel: 'Uncategorized',
    })

    const series = buildDailySeries(lines, Date.parse('2026-01-01T00:00:00.000Z'), Date.parse('2026-01-03T00:00:00.000Z'))
    expect(series.map((s) => s.day)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(series[0].costCents).toBe(100)
    expect(series[1].costCents).toBe(0)
  })
})
