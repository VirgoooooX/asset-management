import { describe, expect, it } from 'vitest'
import { calcBillableHoursCeil } from './costing'

describe('calcBillableHoursCeil', () => {
  it('rounds up to 1 hour for 1 minute', () => {
    const hours = calcBillableHoursCeil('2026-01-01T00:00:00.000Z', '2026-01-01T00:01:00.000Z')
    expect(hours).toBe(1)
  })

  it('returns 1 hour for exactly 1 hour', () => {
    const hours = calcBillableHoursCeil('2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z')
    expect(hours).toBe(1)
  })

  it('rounds up to 2 hours for 1 hour + 1 second', () => {
    const hours = calcBillableHoursCeil('2026-01-01T00:00:00.000Z', '2026-01-01T01:00:01.000Z')
    expect(hours).toBe(2)
  })

  it('returns 0 for non-positive duration', () => {
    const hours = calcBillableHoursCeil('2026-01-01T01:00:00.000Z', '2026-01-01T01:00:00.000Z')
    expect(hours).toBe(0)
  })
})

