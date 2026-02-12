import { describe, expect, it, vi } from 'vitest'
import { fetchReadIdsForUser, markAllRead, markRead } from './notificationService'

const apiFetchMock = vi.hoisted(() => vi.fn(async (..._args: any[]) => ({ ids: ['a'] })))

vi.mock('./apiClient', () => ({
  apiFetch: apiFetchMock as any,
}))

describe('notificationService', () => {
  it('fetchReadIdsForUser calls GET /api/notifications/reads', async () => {
    apiFetchMock.mockResolvedValueOnce({ ids: ['x', 'y'] })
    const ids = await fetchReadIdsForUser()
    expect(ids).toEqual(['x', 'y'])
    expect(apiFetchMock).toHaveBeenCalledWith('/api/notifications/reads')
  })

  it('markRead posts to /api/notifications/read', async () => {
    await markRead('n1')
    expect(apiFetchMock).toHaveBeenCalledWith('/api/notifications/read', expect.objectContaining({ method: 'POST' }))
  })

  it('markAllRead posts ids to /api/notifications/read-all', async () => {
    await markAllRead(['n1', 'n2'])
    const calls = (apiFetchMock as any).mock.calls as any[]
    const call = calls.find((c) => c?.[0] === '/api/notifications/read-all')
    expect(call?.[1]?.method).toBe('POST')
    expect(call?.[1]?.body).toBe(JSON.stringify({ ids: ['n1', 'n2'] }))
  })
})
