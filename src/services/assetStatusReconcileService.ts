import { apiFetch } from './apiClient'

export const reconcileAssetStatusesFromUsageLogs = async (): Promise<number> => {
  const res = await apiFetch<{ updated: number }>('/api/admin/reconcile/asset-status', { method: 'POST' })
  return typeof res.updated === 'number' ? res.updated : 0
}
