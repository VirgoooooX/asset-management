export type RateSource = 'snapshot' | 'asset'

export const getEffectiveHourlyRateCents = (params: {
  usageLog: { hourlyRateCentsSnapshot?: number }
  assetHourlyRateCents: number
}): { hourlyRateCents: number; source: RateSource } => {
  const snap = params.usageLog.hourlyRateCentsSnapshot
  if (typeof snap === 'number' && Number.isFinite(snap)) {
    return { hourlyRateCents: Math.max(0, Math.round(snap)), source: 'snapshot' }
  }
  const asset = Number.isFinite(params.assetHourlyRateCents) ? Math.max(0, Math.round(params.assetHourlyRateCents)) : 0
  return { hourlyRateCents: asset, source: 'asset' }
}

