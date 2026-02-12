import { apiFetch } from './apiClient'

export type AssetCategoryRate = {
  category: string
  hourlyRateCents: number
}

export const fetchAssetCategoryRates = async (): Promise<AssetCategoryRate[]> => {
  const res = await apiFetch<{ items: AssetCategoryRate[] }>('/api/admin/asset-category-rates')
  return Array.isArray(res.items) ? res.items : []
}

export const upsertAssetCategoryRate = async (p: AssetCategoryRate): Promise<void> => {
  await apiFetch('/api/admin/asset-category-rates', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ category: p.category, hourlyRateCents: p.hourlyRateCents }),
  })
}
