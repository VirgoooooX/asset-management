import { describe, expect, it } from 'vitest'
import { selectDerivedAlerts } from './alertsSelectors'

describe('alertsSelectors', () => {
  it('derives calibration due, overdue and long-occupancy alerts', () => {
    const nowMs = new Date('2026-01-10T00:00:00.000Z').getTime()
    const state: any = {
      assets: {
        assets: [
          {
            id: 'a1',
            type: 'chamber',
            name: 'C-01',
            status: 'in-use',
            manufacturer: 'M',
            model: 'X',
            createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
            calibrationDate: new Date('2026-01-15T00:00:00.000Z').toISOString(),
          },
        ],
        loading: false,
        error: null,
      },
      usageLogs: {
        usageLogs: [
          {
            id: 'overdue-1',
            chamberId: 'a1',
            user: 'u',
            startTime: new Date('2026-01-09T00:00:00.000Z').toISOString(),
            endTime: new Date('2026-01-09T02:00:00.000Z').toISOString(),
            status: 'in-progress',
            createdAt: new Date('2026-01-09T00:00:00.000Z').toISOString(),
          },
          {
            id: 'long-1',
            chamberId: 'a1',
            user: 'u',
            startTime: new Date('2025-12-31T00:00:00.000Z').toISOString(),
            status: 'in-progress',
            createdAt: new Date('2025-12-31T00:00:00.000Z').toISOString(),
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

    const alerts = selectDerivedAlerts(state, nowMs)
    const types = new Set(alerts.map((a: any) => a.type))
    expect(types.has('calibration-due')).toBe(true)
    expect(types.has('usage-overdue')).toBe(true)
    expect(types.has('usage-long')).toBe(true)
  })
})
