import { Asset, AssetType } from '../types'
import { apiFetch } from './apiClient'

export type AssetUpdate = Partial<Omit<Omit<Asset, 'id' | 'type' | 'createdAt'>, 'calibrationDate' | 'capabilities'>> & {
  calibrationDate?: string | null
  capabilities?: Asset['capabilities'] | null
}

export const getAssets = async (): Promise<Asset[]> => {
  const data = await apiFetch<{ items: Asset[] }>('/api/assets')
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
): Promise<Asset> => {
  const data = await apiFetch<{ id: string; item?: Asset }>('/api/assets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(assetData),
  })
  if (data.item) return data.item
  const fetched = await getAssetById(data.id)
  if (!fetched) throw new Error('资产创建成功，但未能获取到创建后的数据。')
  return fetched
}

export const updateAsset = async (
  id: string,
  assetUpdateData: AssetUpdate
): Promise<Asset> => {
  const data = await apiFetch<{ ok: boolean; item?: Asset }>(`/api/assets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(assetUpdateData),
  })
  if (data.item) return data.item
  const fetched = await getAssetById(id)
  if (!fetched) throw new Error('更新资产后未能检索到该资产。')
  return fetched
}

export const deleteAsset = async (id: string): Promise<void> => {
  await apiFetch(`/api/assets/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
