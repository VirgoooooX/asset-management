import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { apiFetch } from '../services/apiClient'

export type ThemeMode = 'light' | 'dark'
export type DensityMode = 'comfortable' | 'compact'
export type DashboardRangePreset = '7d' | '30d' | '90d'
export type DashboardGroupBy = 'category' | 'location'
export type Language = 'zh' | 'en'
export type SidebarMode = 'auto' | 'lockedOpen' | 'lockedCollapsed'

export interface SettingsState {
  language: Language
  themeMode: ThemeMode
  density: DensityMode
  primaryColor: string
  nav: {
    sidebarMode: SidebarMode
  }
  timeline: {
    shiftStartMinutes: number
  }
  dashboard: {
    rangePreset: DashboardRangePreset
    groupBy: DashboardGroupBy
  }
  alerts: {
    calibrationDaysThreshold: number
    longOccupancyHoursThreshold: number
  }
  refreshSeconds: number
}

const STORAGE_KEY = 'settings'

const initialState: SettingsState = {
  language: 'zh',
  themeMode: 'light',
  density: 'comfortable',
  primaryColor: '#155EEF',
  nav: {
    sidebarMode: 'auto',
  },
  timeline: {
    shiftStartMinutes: 420,
  },
  dashboard: {
    rangePreset: '30d',
    groupBy: 'category',
  },
  alerts: {
    calibrationDaysThreshold: 30,
    longOccupancyHoursThreshold: 72,
  },
  refreshSeconds: 0,
}

const persist = (state: SettingsState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const mergeSettings = (state: SettingsState, raw: Partial<SettingsState> & { nav?: any }): SettingsState => {
  const nav = raw?.nav ? { ...raw.nav } : undefined
  if (nav && nav.sidebarMode === undefined && nav.sidebarPinned !== undefined) {
    nav.sidebarMode = nav.sidebarPinned ? 'lockedOpen' : 'auto'
    delete nav.sidebarPinned
  }
  return {
    ...state,
    ...raw,
    nav: { ...state.nav, ...nav },
    timeline: { ...state.timeline, ...raw?.timeline },
    dashboard: { ...state.dashboard, ...raw?.dashboard },
    alerts: { ...state.alerts, ...raw?.alerts },
  }
}

export const loadSettingsFromBackend = createAsyncThunk<
  Partial<SettingsState>,
  void,
  { rejectValue: string }
>('settings/loadSettingsFromBackend', async (_, { rejectWithValue }) => {
  try {
    const data = await apiFetch<{ preferences: any }>('/api/users/me/preferences', { method: 'GET' })
    const remote = data?.preferences?.uiSettings
    if (remote && typeof remote === 'object') return remote as Partial<SettingsState>
    return {}
  } catch (e: any) {
    return rejectWithValue(e?.message || '加载云端设置失败')
  }
})

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    loadSettingsFromStorage(state) {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      try {
        const parsed = JSON.parse(stored)
        return mergeSettings(state, parsed)
      } catch {
        return state
      }
    },
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload
      persist(state)
    },
    setLanguage(state, action: PayloadAction<Language>) {
      state.language = action.payload
      persist(state)
    },
    toggleThemeMode(state) {
      state.themeMode = state.themeMode === 'light' ? 'dark' : 'light'
      persist(state)
    },
    setDensity(state, action: PayloadAction<DensityMode>) {
      state.density = action.payload
      persist(state)
    },
    setPrimaryColor(state, action: PayloadAction<string>) {
      state.primaryColor = action.payload
      persist(state)
    },
    setTimelineShiftStartMinutes(state, action: PayloadAction<number>) {
      const next = Math.max(0, Math.min(1439, Math.floor(action.payload)))
      state.timeline.shiftStartMinutes = next
      persist(state)
    },
    setDashboardRangePreset(state, action: PayloadAction<DashboardRangePreset>) {
      state.dashboard.rangePreset = action.payload
      persist(state)
    },
    setDashboardGroupBy(state, action: PayloadAction<DashboardGroupBy>) {
      state.dashboard.groupBy = action.payload
      persist(state)
    },
    setCalibrationDaysThreshold(state, action: PayloadAction<number>) {
      state.alerts.calibrationDaysThreshold = Math.max(1, Math.floor(action.payload))
      persist(state)
    },
    setLongOccupancyHoursThreshold(state, action: PayloadAction<number>) {
      state.alerts.longOccupancyHoursThreshold = Math.max(1, Math.floor(action.payload))
      persist(state)
    },
    setRefreshSeconds(state, action: PayloadAction<number>) {
      state.refreshSeconds = Math.max(0, Math.floor(action.payload))
      persist(state)
    },
    setSidebarMode(state, action: PayloadAction<SidebarMode>) {
      state.nav.sidebarMode = action.payload
      persist(state)
    },
    applySettingsFromRemote(state, action: PayloadAction<Partial<SettingsState>>) {
      const next = mergeSettings(state, action.payload)
      persist(next)
      return next
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadSettingsFromBackend.fulfilled, (state, action) => {
      const next = mergeSettings(state, action.payload)
      persist(next)
      return next
    })
  },
})

export const {
  loadSettingsFromStorage,
  setLanguage,
  setThemeMode,
  toggleThemeMode,
  setDensity,
  setPrimaryColor,
  setTimelineShiftStartMinutes,
  setDashboardRangePreset,
  setDashboardGroupBy,
  setCalibrationDaysThreshold,
  setLongOccupancyHoursThreshold,
  setRefreshSeconds,
  setSidebarMode,
  applySettingsFromRemote,
} = settingsSlice.actions

export default settingsSlice.reducer
