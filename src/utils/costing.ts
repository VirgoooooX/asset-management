import { isValid, parseISO } from 'date-fns'

export const parseMs = (value: string | undefined): number | null => {
  if (!value) return null
  const d = parseISO(value)
  if (!isValid(d)) return null
  const ms = d.getTime()
  if (!Number.isFinite(ms)) return null
  return ms
}

export const calcBillableHoursCeil = (startIso: string, endIso: string): number | null => {
  const startMs = parseMs(startIso)
  const endMs = parseMs(endIso)
  if (startMs === null || endMs === null) return null
  const durationMs = endMs - startMs
  if (!(durationMs > 0)) return 0
  return Math.ceil(durationMs / (60 * 60 * 1000))
}

export const calcCostCents = (billableHours: number, hourlyRateCents: number): number => {
  const hours = Number.isFinite(billableHours) ? Math.max(0, billableHours) : 0
  const rate = Number.isFinite(hourlyRateCents) ? Math.max(0, Math.round(hourlyRateCents)) : 0
  return hours * rate
}

