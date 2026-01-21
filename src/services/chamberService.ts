import { apiFetch } from './apiClient'
import type { Asset, Chamber } from '../types'

const mapAssetToChamber = (a: Asset): Chamber => ({
  id: a.id,
  name: a.name,
  status: a.status,
  description: a.description,
  manufacturer: a.manufacturer ?? '未知制造商',
  model: a.model ?? '未知型号',
  calibrationDate: a.calibrationDate,
  createdAt: a.createdAt,
})

export const getAllChambers = async (): Promise<Chamber[]> => {
  const data = await apiFetch<{ items: Asset[] }>('/api/assets?type=chamber')
  const assets = Array.isArray(data.items) ? data.items : []
  return assets.map(mapAssetToChamber)
}

export const getChamberById = async (id: string): Promise<Chamber | null> => {
  try {
    const data = await apiFetch<{ item: Asset }>(`/api/assets/${encodeURIComponent(id)}`)
    if (!data.item) return null
    return mapAssetToChamber(data.item)
  } catch (e: any) {
    if (e?.status === 404) return null
    throw e
  }
}

export const createChamber = async (chamberData: Omit<Chamber, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const payload: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> = {
    type: 'chamber',
    name: chamberData.name,
    status: chamberData.status,
    description: chamberData.description,
    manufacturer: chamberData.manufacturer,
    model: chamberData.model,
    category: undefined,
    assetCode: undefined,
    calibrationDate: chamberData.calibrationDate,
    tags: undefined,
    location: undefined,
    serialNumber: undefined,
    owner: undefined,
    photoUrls: undefined,
    nameplateUrls: undefined,
    attachments: undefined,
  }
  const res = await apiFetch<{ id: string }>('/api/assets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.id
}

export const updateChamber = async (
  id: string,
  chamberUpdateData: Partial<Omit<Chamber, 'id' | 'createdAt'>>
): Promise<void> => {
  await apiFetch(`/api/assets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(chamberUpdateData),
  })
}

export const deleteChamber = async (id: string): Promise<void> => {
  await apiFetch(`/api/assets/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
