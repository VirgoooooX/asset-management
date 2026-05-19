import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { RootState } from './index'
import { fetchNotifications, fetchReadIdsForUser } from '../services/notificationService'
import type { AppNotification } from '../types'

type NotificationsState = {
  userId: string | null
  items: AppNotification[]
  readIds: Record<string, true>
  hydrated: boolean
  loading: boolean
  error: string | null
}

const initialState: NotificationsState = {
  userId: null,
  items: [],
  readIds: {},
  hydrated: false,
  loading: false,
  error: null,
}

export const hydrateNotifications = createAsyncThunk<
  { userId: string; readIds: Record<string, true>; items: AppNotification[] },
  { userId: string },
  { state: RootState }
>('notifications/hydrate', async ({ userId }) => {
  const [ids, items] = await Promise.all([
    fetchReadIdsForUser().catch(() => []),
    fetchNotifications().catch(() => []),
  ])
  const readIds: Record<string, true> = {}
  ids.forEach((id) => {
    if (typeof id === 'string' && id) readIds[id] = true
  })
  return { userId, readIds, items }
})

export const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    markRead: (state, action: { payload: { id: string } }) => {
      const id = action.payload.id
      if (!id) return
      state.readIds[id] = true
      const item = state.items.find((n) => n.id === id)
      if (item) item.read = true
    },
    markAllRead: (state, action: { payload: { ids: string[] } }) => {
      action.payload.ids.forEach((id) => {
        if (id) state.readIds[id] = true
      })
      state.items.forEach((item) => {
        if (state.readIds[item.id]) item.read = true
      })
    },
    resetNotifications: (state) => {
      state.userId = null
      state.items = []
      state.readIds = {}
      state.hydrated = false
      state.loading = false
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder.addCase(hydrateNotifications.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(hydrateNotifications.fulfilled, (state, action) => {
      state.userId = action.payload.userId
      state.readIds = action.payload.readIds
      state.items = action.payload.items.map((item) => ({
        ...item,
        read: item.read || Boolean(action.payload.readIds[item.id]),
      }))
      state.hydrated = true
      state.loading = false
    })
    builder.addCase(hydrateNotifications.rejected, (state, action) => {
      state.loading = false
      state.error = action.error.message || '加载通知失败'
    })
  },
})

export const { markRead, markAllRead, resetNotifications } = notificationsSlice.actions

export default notificationsSlice.reducer
