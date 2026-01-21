import { describe, expect, it } from 'vitest'
import { selectDashboardKpis } from './kpiSelectors'

describe('kpiSelectors', () => {
  it('computes utilization with per-asset merged intervals', () => {
    const startMs = new Date('2026-01-01T00:00:00.000Z').getTime()
    const endMs = new Date('2026-01-01T10:00:00.000Z').getTime()
    const nowMs = new Date('2026-01-01T10:00:00.000Z').getTime()

    const state: any = {
      assets: {
        assets: [
          {
            id: 'a1',
            type: 'chamber',
            name: 'C-01',
            status: 'available',
            manufacturer: 'M',
            model: 'X',
            createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          },
          {
            id: 'a2',
            type: 'chamber',
            name: 'C-02',
            status: 'available',
            manufacturer: 'M',
            model: 'Y',
            createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
            calibrationDate: new Date('2026-01-06T00:00:00.000Z').toISOString(),
          },
        ],
        loading: false,
        error: null,
      },
      usageLogs: {
        usageLogs: [
          {
            id: 'l1',
            chamberId: 'a1',
            user: 'u',
            startTime: new Date('2026-01-01T01:00:00.000Z').toISOString(),
            endTime: new Date('2026-01-01T03:00:00.000Z').toISOString(),
            status: 'in-progress',
            createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          },
          {
            id: 'l2',
            chamberId: 'a1',
            user: 'u',
            startTime: new Date('2026-01-01T02:00:00.000Z').toISOString(),
            endTime: new Date('2026-01-01T04:00:00.000Z').toISOString(),
            status: 'in-progress',
            createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          },
        ],
        loading: false,
        error: null,
      },
      settings: {
        themeMode: 'light',
        density: 'comfortable',
        primaryColor: '#155EEF',
        dashboard: { rangePreset: '30d' },
        alerts: { calibrationDaysThreshold: 30, longOccupancyHoursThreshold: 72 },
        refreshSeconds: 0,
      },
    }

    const kpis = selectDashboardKpis(state, startMs, endMs, 30, nowMs)
    expect(kpis.totalAssets).toBe(2)
    expect(kpis.utilization.capacityMs).toBe(2 * (endMs - startMs))
    expect(kpis.utilization.occupiedMs).toBe(3 * 60 * 60 * 1000)
    expect(kpis.utilization.ratio).toBeCloseTo(0.15)
    expect(kpis.calibrationDueSoon.count).toBe(1)
  })
})
