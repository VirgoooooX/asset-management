import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { apiFetch } from '../services/apiClient'

export type ThemeMode = 'light' | 'dark'
export type DensityMode = 'comfortable' | 'compact'
export type DashboardRangePreset = '7d' | '30d' | '90d'
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
  dashboard: {
    rangePreset: DashboardRangePreset
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
  dashboard: {
    rangePreset: '30d',
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
        const parsed = JSON.parse(stored) as any
        if (parsed?.nav?.sidebarMode === undefined && parsed?.nav?.sidebarPinned !== undefined) {
          parsed.nav.sidebarMode = parsed.nav.sidebarPinned ? 'lockedOpen' : 'auto'
          delete parsed.nav.sidebarPinned
        }
        return {
          ...state,
          ...parsed,
          nav: { ...state.nav, ...parsed.nav },
          dashboard: { ...state.dashboard, ...parsed.dashboard },
          alerts: { ...state.alerts, ...parsed.alerts }
        }
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
    setDashboardRangePreset(state, action: PayloadAction<DashboardRangePreset>) {
      state.dashboard.rangePreset = action.payload
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
      const parsed = action.payload as any
      if (parsed?.nav?.sidebarMode === undefined && parsed?.nav?.sidebarPinned !== undefined) {
        parsed.nav.sidebarMode = parsed.nav.sidebarPinned ? 'lockedOpen' : 'auto'
        delete parsed.nav.sidebarPinned
      }
      const next = {
        ...state,
        ...parsed,
        nav: { ...state.nav, ...parsed.nav },
        dashboard: { ...state.dashboard, ...parsed.dashboard },
        alerts: { ...state.alerts, ...parsed.alerts },
      }
      persist(next)
      return next
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadSettingsFromBackend.fulfilled, (state, action) => {
      const parsed = action.payload as any
      if (parsed?.nav?.sidebarMode === undefined && parsed?.nav?.sidebarPinned !== undefined) {
        parsed.nav.sidebarMode = parsed.nav.sidebarPinned ? 'lockedOpen' : 'auto'
        delete parsed.nav.sidebarPinned
      }
      const next = {
        ...state,
        ...parsed,
        nav: { ...state.nav, ...parsed.nav },
        dashboard: { ...state.dashboard, ...parsed.dashboard },
        alerts: { ...state.alerts, ...parsed.alerts },
      }
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
  setDashboardRangePreset,
  setCalibrationDaysThreshold,
  setLongOccupancyHoursThreshold,
  setRefreshSeconds,
  setSidebarMode,
  applySettingsFromRemote,
} = settingsSlice.actions

export default settingsSlice.reducer
