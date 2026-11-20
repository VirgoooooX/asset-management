import { apiFetch, apiFetchBlob } from './apiClient'

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

type AuditLogFilterParams = {
  from?: string
  to?: string
  actorUserId?: string
  actorUsername?: string
  action?: string
  entityType?: string
  entityId?: string
  requestId?: string
}

const buildAuditQuery = (params: AuditLogFilterParams) => {
  const q = new URLSearchParams()
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  if (params.actorUserId) q.set('actorUserId', params.actorUserId)
  if (params.actorUsername) q.set('actorUsername', params.actorUsername)
  if (params.action) q.set('action', params.action)
  if (params.entityType) q.set('entityType', params.entityType)
  if (params.entityId) q.set('entityId', params.entityId)
  if (params.requestId) q.set('requestId', params.requestId)
  return q
}

export const getAuditLogs = async (
  params: AuditLogFilterParams & { page?: number; pageSize?: number }
): Promise<{ total: number; items: AuditLogItem[] }> => {
  const q = buildAuditQuery(params)
  if (params.page !== undefined) q.set('page', String(params.page))
  if (params.pageSize !== undefined) q.set('pageSize', String(params.pageSize))
  const data = await apiFetch<{ total: number; items: AuditLogItem[] }>(`/api/admin/audit-logs?${q.toString()}`)
  return {
    total: typeof data.total === 'number' ? data.total : 0,
    items: Array.isArray(data.items) ? data.items : [],
  }
}

export const exportAuditLogsCsv = async (params: AuditLogFilterParams & { limit?: number }) => {
  const q = buildAuditQuery(params)
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) q.set('limit', String(params.limit))

  const blob = await apiFetchBlob(`/api/admin/audit-logs/export?${q.toString()}`, { method: 'GET' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'audit-logs.csv'
  a.click()
  URL.revokeObjectURL(url)
}
