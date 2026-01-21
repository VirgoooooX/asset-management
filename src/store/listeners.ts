import type { AnyAction } from '@reduxjs/toolkit'
import { createListenerMiddleware } from '@reduxjs/toolkit'
import { apiFetch } from '../services/apiClient'

export const listenerMiddleware = createListenerMiddleware()

let pending: any = null

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
