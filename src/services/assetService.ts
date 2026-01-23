import { Asset, AssetType } from '../types'
import { apiFetch } from './apiClient'

export type AssetUpdate = Partial<Omit<Omit<Asset, 'id' | 'type' | 'createdAt'>, 'calibrationDate'>> & {
  calibrationDate?: string | null
}

export const getAssets = async (): Promise<Asset[]> => {
  const data = await apiFetch<{ items: Asset[] }>(`/api/assets`)
  return Array.isArray(data.items) ? data.items : []
}

export const getAssetsByType = async (type: AssetType): Promise<Asset[]> => {
  const data = await apiFetch<{ items: Asset[] }>(`/api/assets?type=${encodeURIComponent(type)}`)
  return Array.isArray(data.items) ? data.items : []
}

export const getAssetById = async (id: string): Promise<Asset | null> => {
  try {
    const data = await apiFetch<{ item: Asset }>(`/api/assets/${encodeURIComponent(id)}`)
    return data.item ?? null
  } catch (e: any) {
    if (e?.status === 404) return null
    throw e
  }
}

export const createAsset = async (
  assetData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const data = await apiFetch<{ id: string }>('/api/assets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(assetData),
  })
  return data.id
}

export const updateAsset = async (
  id: string,
  assetUpdateData: AssetUpdate
): Promise<void> => {
  await apiFetch(`/api/assets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(assetUpdateData),
  })
}

export const deleteAsset = async (id: string): Promise<void> => {
  await apiFetch(`/api/assets/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
