import { apiFetch } from './apiClient'
import { getAccessToken } from './session'

export type AuditLogItem = {
  id: string
  at: string
  actorUserId: string
  actorUsername: string
  action: string
  entityType: string
  entityId: string
  ip?: string
  userAgent?: string
  requestId?: string
  before?: any
  after?: any
}

export const getAuditLogs = async (params: {
  page?: number
  pageSize?: number
  from?: string
  to?: string
  actorUserId?: string
  actorUsername?: string
  action?: string
  entityType?: string
  entityId?: string
  requestId?: string
}): Promise<{ total: number; items: AuditLogItem[] }> => {
  const q = new URLSearchParams()
  if (params.page !== undefined) q.set('page', String(params.page))
  if (params.pageSize !== undefined) q.set('pageSize', String(params.pageSize))
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  if (params.actorUserId) q.set('actorUserId', params.actorUserId)
  if (params.actorUsername) q.set('actorUsername', params.actorUsername)
  if (params.action) q.set('action', params.action)
  if (params.entityType) q.set('entityType', params.entityType)
  if (params.entityId) q.set('entityId', params.entityId)
  if (params.requestId) q.set('requestId', params.requestId)
  const url = `/api/admin/audit-logs?${q.toString()}`
  const data = await apiFetch<{ total: number; items: AuditLogItem[] }>(url)
  return {
    total: typeof data.total === 'number' ? data.total : 0,
    items: Array.isArray(data.items) ? data.items : [],
  }
}

const baseUrl = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) ?? ''

const joinUrl = (path: string) => {
  if (!baseUrl) return path
  const a = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const b = path.startsWith('/') ? path : `/${path}`
  return a + b
}

export const exportAuditLogsCsv = async (params: {
  from?: string
  to?: string
  actorUserId?: string
  actorUsername?: string
  action?: string
  entityType?: string
  entityId?: string
  requestId?: string
  limit?: number
}) => {
  const q = new URLSearchParams()
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  if (params.actorUserId) q.set('actorUserId', params.actorUserId)
  if (params.actorUsername) q.set('actorUsername', params.actorUsername)
  if (params.action) q.set('action', params.action)
  if (params.entityType) q.set('entityType', params.entityType)
  if (params.entityId) q.set('entityId', params.entityId)
  if (params.requestId) q.set('requestId', params.requestId)
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) q.set('limit', String(params.limit))

  const token = getAccessToken()
  const res = await fetch(joinUrl(`/api/admin/audit-logs/export?${q.toString()}`), {
    method: 'GET',
    credentials: 'include',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) throw new Error(`export_failed_${res.status}`)

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'audit-logs.csv'
  a.click()
  URL.revokeObjectURL(url)
}
