import { apiFetch } from './apiClient'

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

