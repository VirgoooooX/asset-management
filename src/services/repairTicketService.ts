import { apiFetch } from './apiClient'
import type { RepairStatus, RepairTicket } from '../types'

export const getRepairTickets = async (
  filters?: { status?: RepairStatus; assetId?: string }
): Promise<RepairTicket[]> => {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.assetId) params.set('assetId', filters.assetId)
  const qs = params.toString()
  const data = await apiFetch<{ items: RepairTicket[] }>(`/api/repair-tickets${qs ? `?${qs}` : ''}`)
  return Array.isArray(data.items) ? data.items : []
}

export const getRepairTicketById = async (id: string): Promise<RepairTicket | null> => {
  try {
    const data = await apiFetch<{ item: RepairTicket }>(`/api/repair-tickets/${encodeURIComponent(id)}`)
    return data.item ?? null
  } catch (e: any) {
    if (e?.status === 404) return null
    throw e
  }
}

export const createRepairTicket = async (data: {
  assetId: string
  problemDesc: string
  expectedReturnAt?: string
}): Promise<string> => {
  const res = await apiFetch<{ id: string }>('/api/repair-tickets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.id
}

export const updateRepairTicket = async (
  id: string,
  changes: Partial<Pick<RepairTicket, 'problemDesc' | 'vendorName' | 'quoteAmount' | 'expectedReturnAt'>>
): Promise<void> => {
  await apiFetch(`/api/repair-tickets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(changes),
  })
}

export const transitionRepairTicketStatus = async (args: {
  id: string
  to: RepairStatus
  note?: string
  vendorName?: string
  quoteAmount?: number
}): Promise<void> => {
  const { id, ...rest } = args
  await apiFetch(`/api/repair-tickets/${encodeURIComponent(id)}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(rest),
  })
}

export const deleteRepairTicket = async (id: string): Promise<void> => {
  await apiFetch(`/api/repair-tickets/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

