import { describe, expect, it, vi } from 'vitest'
import { fetchAssetCategoryRates, upsertAssetCategoryRate } from './assetCategoryRateService'

const apiFetchMock = vi.hoisted(() => vi.fn(async (..._args: any[]) => ({ items: [] as any[] })))

vi.mock('./apiClient', () => ({
  apiFetch: apiFetchMock as any,
}))

describe('assetCategoryRateService', () => {
  it('fetches /api/admin/asset-category-rates', async () => {
    apiFetchMock.mockResolvedValueOnce({ items: [{ category: 'A', hourlyRateCents: 123 }] })
    const items = await fetchAssetCategoryRates()
    expect(items).toEqual([{ category: 'A', hourlyRateCents: 123 }])
    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/asset-category-rates')
  })

  it('upserts via PUT /api/admin/asset-category-rates', async () => {
    await upsertAssetCategoryRate({ category: 'A', hourlyRateCents: 500 })
    const call = (apiFetchMock as any).mock.calls.find(
      (c: any[]) => c?.[0] === '/api/admin/asset-category-rates' && c?.[1]?.method === 'PUT'
    )
    expect(call?.[1]?.method).toBe('PUT')
    expect(call?.[1]?.body).toBe(JSON.stringify({ category: 'A', hourlyRateCents: 500 }))
  })
})
