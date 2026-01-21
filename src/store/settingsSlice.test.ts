import { describe, expect, it, beforeEach } from 'vitest'
import reducer, { loadSettingsFromStorage, setDashboardRangePreset, setThemeMode } from './settingsSlice'

const createMemoryStorage = () => {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    clear: () => {
      map.clear()
    },
  }
}

describe('settingsSlice', () => {
  beforeEach(() => {
    (globalThis as any).localStorage = createMemoryStorage()
  })

  it('persists settings changes to localStorage', () => {
    const state1 = reducer(undefined, setThemeMode('dark'))
    expect(state1.themeMode).toBe('dark')
    const stored = (globalThis as any).localStorage.getItem('settings')
    expect(stored).toContain('"themeMode":"dark"')
  })

  it('loads stored settings and preserves defaults for missing fields', () => {
    (globalThis as any).localStorage.setItem('settings', JSON.stringify({ dashboard: { rangePreset: '7d' } }))
    const state1 = reducer(undefined, loadSettingsFromStorage())
    expect(state1.dashboard.rangePreset).toBe('7d')
    expect(state1.alerts.calibrationDaysThreshold).toBeGreaterThan(0)
  })

  it('updates dashboard preset', () => {
    const state1 = reducer(undefined, setDashboardRangePreset('90d'))
    expect(state1.dashboard.rangePreset).toBe('90d')
  })
})
