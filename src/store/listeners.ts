import type { AnyAction } from '@reduxjs/toolkit'
import { createListenerMiddleware } from '@reduxjs/toolkit'
import { apiFetch } from '../services/apiClient'
import { fetchAssetById } from './assetsSlice'

export const listenerMiddleware = createListenerMiddleware()

let pending: any = null
let eventSource: EventSource | null = null
const pendingAssetRefresh = new Map<string, any>()

const scheduleAssetRefresh = (api: any, assetId: string) => {
  const existing = pendingAssetRefresh.get(assetId)
  if (existing) clearTimeout(existing)
  const t = setTimeout(() => {
    pendingAssetRefresh.delete(assetId)
    api.dispatch(fetchAssetById({ id: assetId }))
  }, 150)
  pendingAssetRefresh.set(assetId, t)
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
