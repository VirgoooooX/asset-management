import { describe, expect, it } from 'vitest'
import reducer, { upsertTicket } from './repairTicketsSlice'
import type { RepairTicket } from '../types'

describe('repairTicketsSlice', () => {
  it('upserts a ticket', () => {
    const ticket: RepairTicket = {
      id: 't1',
      assetId: 'a1',
      status: 'quote-pending',
      problemDesc: 'x',
      createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    }

    const state1 = reducer(undefined, upsertTicket(ticket))
    expect(state1.tickets).toHaveLength(1)
    expect(state1.tickets[0].id).toBe('t1')

    const state2 = reducer(
      state1,
      upsertTicket({
        ...ticket,
        status: 'repair-pending',
      })
    )
    expect(state2.tickets).toHaveLength(1)
    expect(state2.tickets[0].status).toBe('repair-pending')
  })
})

