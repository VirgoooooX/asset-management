import { describe, expect, it, vi } from 'vitest'
import { fetchProjectCostReport } from './reportService'

const apiFetchMock = vi.hoisted(() => vi.fn(async (..._args: any[]) => ({ summary: {}, groups: [], series: [] })))

vi.mock('./apiClient', () => ({
  apiFetch: apiFetchMock as any,
}))

describe('reportService', () => {
  it('builds query string for project cost report', async () => {
    apiFetchMock.mockResolvedValueOnce({ summary: { range: { startMs: 1, endMs: 2 } }, groups: [], series: [] })
    await fetchProjectCostReport({
      rangeStartMs: 1,
      rangeEndMs: 2,
      projectId: 'all',
      groupBy: 'asset',
      includeUnlinked: true,
      includeInProgress: false,
    })
    const path = (apiFetchMock as any).mock.calls[0]?.[0]
    expect(String(path)).toContain('/api/reports/project-cost?')
    expect(String(path)).toContain('rangeStartMs=1')
    expect(String(path)).toContain('rangeEndMs=2')
    expect(String(path)).toContain('projectId=all')
    expect(String(path)).toContain('groupBy=asset')
    expect(String(path)).toContain('includeUnlinked=1')
    expect(String(path)).toContain('includeInProgress=0')
  })
})

