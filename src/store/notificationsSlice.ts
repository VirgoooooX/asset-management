import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { RootState } from './index'
import { fetchReadIdsForUser } from '../services/notificationService'

type NotificationsState = {
  userId: string | null
  readIds: Record<string, true>
  hydrated: boolean
}

const initialState: NotificationsState = {
  userId: null,
  readIds: {},
  hydrated: false,
}

export const hydrateNotifications = createAsyncThunk<
  { userId: string; readIds: Record<string, true> },
  { userId: string },
  { state: RootState }
>('notifications/hydrate', async ({ userId }) => {
  const ids = await fetchReadIdsForUser().catch(() => [])
  const readIds: Record<string, true> = {}
  ids.forEach((id) => {
    if (typeof id === 'string' && id) readIds[id] = true
  })
  return { userId, readIds }
})

export const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    markRead: (state, action: { payload: { id: string } }) => {
      const id = action.payload.id
      if (!id) return
      state.readIds[id] = true
    },
    markAllRead: (state, action: { payload: { ids: string[] } }) => {
      action.payload.ids.forEach((id) => {
        if (id) state.readIds[id] = true
      })
    },
    resetNotifications: (state) => {
      state.userId = null
      state.readIds = {}
      state.hydrated = false
    },
  },
  extraReducers: (builder) => {
    builder.addCase(hydrateNotifications.fulfilled, (state, action) => {
      state.userId = action.payload.userId
      state.readIds = action.payload.readIds
      state.hydrated = true
    })
  },
})

export const { markRead, markAllRead, resetNotifications } = notificationsSlice.actions

export default notificationsSlice.reducer
