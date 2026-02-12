import type { AnyAction } from '@reduxjs/toolkit'
import { createListenerMiddleware } from '@reduxjs/toolkit'
import { apiFetch } from '../services/apiClient'
import { fetchAssetById } from './assetsSlice'
import { fetchRepairTickets } from './repairTicketsSlice'
import { fetchUsageLogs } from './usageLogsSlice'
import { resetNotifications } from './notificationsSlice'
import { markAllRead as markAllReadApi, markRead as markReadApi } from '../services/notificationService'

export const listenerMiddleware = createListenerMiddleware()

let pending: any = null
let eventSource: EventSource | null = null
const pendingAssetRefresh = new Map<string, any>()
let pendingRepairsRefresh: any = null
let pendingUsageLogsRefresh: any = null

const scheduleAssetRefresh = (api: any, assetId: string) => {
  const existing = pendingAssetRefresh.get(assetId)
  if (existing) clearTimeout(existing)
  const t = setTimeout(() => {
    pendingAssetRefresh.delete(assetId)
    api.dispatch(fetchAssetById({ id: assetId }))
  }, 150)
  pendingAssetRefresh.set(assetId, t)
}

const scheduleRepairsRefresh = (api: any) => {
  if (pendingRepairsRefresh) clearTimeout(pendingRepairsRefresh)
  pendingRepairsRefresh = setTimeout(() => {
    pendingRepairsRefresh = null
    api.dispatch(fetchRepairTickets({ force: true }))
  }, 250)
}

const scheduleUsageLogsRefresh = (api: any) => {
  if (pendingUsageLogsRefresh) clearTimeout(pendingUsageLogsRefresh)
  pendingUsageLogsRefresh = setTimeout(() => {
    pendingUsageLogsRefresh = null
    api.dispatch(fetchUsageLogs({ force: true }))
  }, 300)
}

const ensureEventStream = (api: any) => {
  const state = api.getState() as any
  const authed = Boolean(state?.auth?.isAuthenticated)
  if (!authed) {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    for (const t of pendingAssetRefresh.values()) clearTimeout(t)
    pendingAssetRefresh.clear()
    if (pendingRepairsRefresh) clearTimeout(pendingRepairsRefresh)
    if (pendingUsageLogsRefresh) clearTimeout(pendingUsageLogsRefresh)
    pendingRepairsRefresh = null
    pendingUsageLogsRefresh = null
    return
  }
  if (eventSource) return

  const es = new EventSource('/api/events', { withCredentials: true })
  eventSource = es

  es.addEventListener('asset_status_changed', (evt: MessageEvent) => {
    const data = (() => {
      try {
        return JSON.parse(String(evt.data || 'null'))
      } catch {
        return null
      }
    })() as any
    const assetId = typeof data?.assetId === 'string' ? data.assetId : ''
    if (!assetId) return
    scheduleAssetRefresh(api, assetId)
  })

  es.addEventListener('asset_updated', (evt: MessageEvent) => {
    const data = (() => {
      try {
        return JSON.parse(String(evt.data || 'null'))
      } catch {
        return null
      }
    })() as any
    const assetId = typeof data?.assetId === 'string' ? data.assetId : ''
    if (!assetId) return
    scheduleAssetRefresh(api, assetId)
  })

  es.addEventListener('repair_ticket_changed', () => {
    scheduleRepairsRefresh(api)
  })

  es.addEventListener('usage_log_changed', () => {
    scheduleUsageLogsRefresh(api)
  })

  es.addEventListener('ready', () => undefined)

  es.onerror = () => {
    const latest = api.getState() as any
    if (!latest?.auth?.isAuthenticated) {
      es.close()
      if (eventSource === es) eventSource = null
    }
  }
}

listenerMiddleware.startListening({
  predicate: (action: AnyAction) => {
    if (typeof action.type !== 'string') return false
    if (!action.type.startsWith('settings/')) return false
    if (action.type === 'settings/loadSettingsFromStorage') return false
    if (action.type === 'settings/applySettingsFromRemote') return false
    return true
  },
  effect: async (_action: AnyAction, api: any) => {
    const state = api.getState() as any
    if (!state?.auth?.isAuthenticated) return

    if (pending) clearTimeout(pending)
    pending = setTimeout(async () => {
      const latest = api.getState() as any
      if (!latest?.auth?.isAuthenticated) return
      await apiFetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uiSettings: latest.settings })
      }).catch(() => undefined)
    }, 600)
  }
})

listenerMiddleware.startListening({
  predicate: (action: AnyAction) => {
    if (typeof action.type !== 'string') return false
    return action.type.startsWith('auth/')
  },
  effect: async (_action: AnyAction, api: any) => {
    ensureEventStream(api)
  }
})

listenerMiddleware.startListening({
  predicate: (action: AnyAction) => action?.type === 'notifications/markRead',
  effect: async (action: AnyAction, api: any) => {
    const state = api.getState() as any
    if (!state?.auth?.isAuthenticated) return
    const id = action?.payload?.id
    if (typeof id !== 'string' || !id) return
    await markReadApi(id).catch(() => undefined)
  },
})

listenerMiddleware.startListening({
  predicate: (action: AnyAction) => action?.type === 'notifications/markAllRead',
  effect: async (action: AnyAction, api: any) => {
    const state = api.getState() as any
    if (!state?.auth?.isAuthenticated) return
    const ids = Array.isArray(action?.payload?.ids) ? action.payload.ids.filter((x: any) => typeof x === 'string' && x) : []
    if (ids.length === 0) return
    await markAllReadApi(ids).catch(() => undefined)
  },
})

listenerMiddleware.startListening({
  predicate: (action: AnyAction) => action?.type === 'auth/signOutUser/fulfilled',
  effect: async (_action: AnyAction, api: any) => {
    api.dispatch(resetNotifications())
  }
})
