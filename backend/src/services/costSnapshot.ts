export type CostSnapshotInput = {
  startIso: string
  endIso: string
  hourlyRateCents: number
}

export type CostSnapshotResult = {
  billableHours: number
  costCents: number
}

export const computeCostSnapshot = (input: CostSnapshotInput): CostSnapshotResult | null => {
  const startMs = Date.parse(input.startIso)
  const endMs = Date.parse(input.endIso)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null
  const durationMs = endMs - startMs
  if (!(durationMs > 0)) return { billableHours: 0, costCents: 0 }
  const billableHours = Math.ceil(durationMs / (60 * 60 * 1000))
  const hourlyRateCents = Number.isFinite(input.hourlyRateCents) ? Math.max(0, Math.round(input.hourlyRateCents)) : 0
  return { billableHours, costCents: billableHours * hourlyRateCents }
}

