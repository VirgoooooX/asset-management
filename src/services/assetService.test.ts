import { describe, expect, it, vi } from 'vitest'
import { getAssetsByType } from './assetService'

vi.mock('./apiClient', () => ({
  apiFetch: vi.fn(async () => ({
    items: [
      {
        id: 'a1',
        type: 'chamber',
        name: 'C-01',
        status: 'available',
        assetCode: 'A-001',
        location: 'Lab-1',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    ],
  })),
}))

describe('assetService', () => {
  it('parses assetCode and location', async () => {
    const assets = await getAssetsByType('chamber' as any)
    expect(assets[0].assetCode).toBe('A-001')
    expect(assets[0].location).toBe('Lab-1')
  })
})
