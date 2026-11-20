import { apiFetch } from './apiClient'
import type { UsageLog } from '../types'

export const getAllUsageLogs = async (): Promise<UsageLog[]> => {
  const data = await apiFetch<{ items: UsageLog[] }>('/api/usage-logs')
  return Array.isArray(data.items) ? data.items : []
}

export const getUsageLogById = async (id: string): Promise<UsageLog | null> => {
  try {
    const data = await apiFetch<{ item: UsageLog }>(`/api/usage-logs/${encodeURIComponent(id)}`)
    return data.item ?? null
  } catch (e: any) {
    if (e?.status === 404) return null
    throw e
  }
}

export const createUsageLog = async (logData: Omit<UsageLog, 'id' | 'createdAt'>): Promise<UsageLog> => {
  const data = await apiFetch<{ id: string; item?: UsageLog }>('/api/usage-logs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(logData),
  })
  if (data.item) return data.item
  const fetched = await getUsageLogById(data.id)
  if (!fetched) throw new Error('使用记录创建成功，但未能获取到创建后的数据。')
  return fetched
}

export const updateUsageLog = async (
  id: string,
  logUpdateData: Partial<Omit<UsageLog, 'id' | 'createdAt'>>
): Promise<UsageLog> => {
  const data = await apiFetch<{ ok: boolean; item?: UsageLog }>(`/api/usage-logs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(logUpdateData),
  })
  if (data.item) return data.item
  const fetched = await getUsageLogById(id)
  if (!fetched) throw new Error('更新使用记录后未能检索到该记录。')
  return fetched
}

export const removeConfigFromUsageLog = async (logId: string, configId: string): Promise<void> => {
  const current = await getUsageLogById(logId)
  if (!current) return
  const next = (current.selectedConfigIds ?? []).filter((id) => id !== configId)
  if (next.length === 0) {
    await deleteUsageLog(logId)
    return
  }
  await updateUsageLog(logId, { selectedConfigIds: next })
}

export const deleteUsageLog = async (id: string): Promise<void> => {
  await apiFetch(`/api/usage-logs/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
