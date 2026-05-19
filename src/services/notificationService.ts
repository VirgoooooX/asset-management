import { apiFetch } from './apiClient'
import type { AppNotification, NotificationChannel, NotificationChannelType, NotificationType } from '../types'

export const fetchNotifications = async (): Promise<AppNotification[]> => {
  const data = await apiFetch<{ items: AppNotification[] }>('/api/notifications')
  return Array.isArray(data.items) ? data.items : []
}

export const fetchReadIdsForUser = async (): Promise<string[]> => {
  const data = await apiFetch<{ ids: string[] }>('/api/notifications/reads')
  return Array.isArray(data.ids) ? data.ids.filter((x) => typeof x === 'string' && x.length > 0) : []
}

export const markRead = async (id: string): Promise<void> => {
  await apiFetch('/api/notifications/read', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  })
}

export const markAllRead = async (ids: string[]): Promise<void> => {
  await apiFetch('/api/notifications/read-all', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
}

export const fetchNotificationChannels = async (): Promise<NotificationChannel[]> => {
  const data = await apiFetch<{ items: NotificationChannel[] }>('/api/admin/notification-channels')
  return Array.isArray(data.items) ? data.items : []
}

export const createNotificationChannel = async (input: {
  type: NotificationChannelType
  name: string
  webhookUrl: string
  enabled?: boolean
  subscribedTypes?: NotificationType[]
}): Promise<string> => {
  const data = await apiFetch<{ id: string }>('/api/admin/notification-channels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return data.id
}

export const updateNotificationChannel = async (
  id: string,
  changes: Partial<{
    type: NotificationChannelType
    name: string
    webhookUrl: string
    enabled: boolean
    subscribedTypes: NotificationType[]
  }>
): Promise<void> => {
  await apiFetch(`/api/admin/notification-channels/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(changes),
  })
}

export const deleteNotificationChannel = async (id: string): Promise<void> => {
  await apiFetch(`/api/admin/notification-channels/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export const testNotificationChannel = async (id: string): Promise<void> => {
  await apiFetch(`/api/admin/notification-channels/${encodeURIComponent(id)}/test`, { method: 'POST' })
}
