import { createSelector } from '@reduxjs/toolkit'
import { getEffectiveUsageLogStatus } from '../utils/statusHelpers'
import type { Asset, UsageLog } from '../types'
import type { RootState } from './index'

const selectAssetsState = (state: RootState) => state.assets
const selectUsageLogsState = (state: RootState) => state.usageLogs

export const selectChamberAssets = createSelector([selectAssetsState], (assetsState) =>
  assetsState.assets.filter((a) => a.type === 'chamber')
)

export const selectUsageLogs = createSelector([selectUsageLogsState], (usageLogsState) => usageLogsState.usageLogs)

type Interval = { startMs: number; endMs: number }

const clipInterval = (startMs: number, endMs: number, clipStartMs: number, clipEndMs: number): Interval | null => {
  const start = Math.max(startMs, clipStartMs)
  const end = Math.min(endMs, clipEndMs)
  if (end <= start) return null
  return { startMs: start, endMs: end }
}

const mergeIntervals = (intervals: Interval[]): Interval[] => {
  if (intervals.length === 0) return []
  const sorted = intervals.slice().sort((a, b) => a.startMs - b.startMs)
  const merged: Interval[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const next = sorted[i]
    if (next.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, next.endMs)
      continue
    }
    merged.push({ ...next })
  }
  return merged
}

const sumIntervalsMs = (intervals: Interval[]): number => intervals.reduce((sum, i) => sum + (i.endMs - i.startMs), 0)

const getUsageLogEndMs = (log: UsageLog, nowMs: number): number => {
  if (log.endTime) {
    const end = Date.parse(log.endTime)
    if (!Number.isNaN(end)) return end
  }
  const effective = getEffectiveUsageLogStatus(log)
  if (effective === 'in-progress' || effective === 'overdue') return nowMs
  const start = Date.parse(log.startTime)
  if (Number.isNaN(start)) return nowMs
  return start + 60 * 60 * 1000
}

export interface DashboardKpis {
  totalAssets: number
  statusCounts: Record<Asset['status'], number>
  overdueActiveCount: number
  utilization: {
    occupiedMs: number
    capacityMs: number
    ratio: number
  }
  calibrationDueSoon: {
    daysThreshold: number
    count: number
    assets: Asset[]
  }
  topBusyAssets: Array<{ asset: Asset; utilizationRatio: number }>
}

export const selectDashboardKpis = createSelector(
  [
    selectChamberAssets,
    selectUsageLogs,
    (_state: RootState, startMs: number) => startMs,
    (_state: RootState, _startMs: number, endMs: number) => endMs,
    (_state: RootState, _startMs: number, _endMs: number, daysThreshold: number) => daysThreshold,
    (_state: RootState, _startMs: number, _endMs: number, _daysThreshold: number, nowMs: number) => nowMs,
  ],
  (assets, usageLogs, startMs, endMs, daysThreshold, nowMs): DashboardKpis => {
    const rangeMs = Math.max(0, endMs - startMs)

    const statusCounts: DashboardKpis['statusCounts'] = {
      available: 0,
      'in-use': 0,
      maintenance: 0,
    }

    assets.forEach((a) => {
      statusCounts[a.status]++
    })

    const assetIds = new Set(assets.map((a) => a.id))

    const intervalsByAssetId = new Map<string, Interval[]>()
    let overdueActiveCount = 0

    for (const log of usageLogs) {
      if (!assetIds.has(log.chamberId)) continue
      const logStart = Date.parse(log.startTime)
      if (Number.isNaN(logStart)) continue
      const logEnd = getUsageLogEndMs(log, nowMs)
      const clipped = clipInterval(logStart, logEnd, startMs, endMs)
      if (!clipped) continue

      const effective = getEffectiveUsageLogStatus(log)
      if (effective === 'overdue') overdueActiveCount++

      const list = intervalsByAssetId.get(log.chamberId) ?? []
      list.push(clipped)
      intervalsByAssetId.set(log.chamberId, list)
    }

    let occupiedMs = 0
    const utilizationByAssetId = new Map<string, number>()
    assets.forEach((asset) => {
      const merged = mergeIntervals(intervalsByAssetId.get(asset.id) ?? [])
      const assetOccupied = sumIntervalsMs(merged)
      occupiedMs += assetOccupied
      utilizationByAssetId.set(asset.id, rangeMs > 0 ? assetOccupied / rangeMs : 0)
    })

    const capacityMs = assets.length * rangeMs
    const ratio = capacityMs > 0 ? Math.min(1, occupiedMs / capacityMs) : 0

    const dueSoonAssets = assets
      .filter((a) => {
        if (!a.calibrationDate) return false
        const ms = Date.parse(a.calibrationDate)
        if (Number.isNaN(ms)) return false
        const deltaDays = (ms - nowMs) / (24 * 60 * 60 * 1000)
        return deltaDays >= 0 && deltaDays <= daysThreshold
      })
      .sort((a, b) => (Date.parse(a.calibrationDate || '') || 0) - (Date.parse(b.calibrationDate || '') || 0))

    const topBusyAssets = assets
      .map((a) => ({ asset: a, utilizationRatio: utilizationByAssetId.get(a.id) ?? 0 }))
      .sort((a, b) => b.utilizationRatio - a.utilizationRatio)
      .slice(0, 6)

    return {
      totalAssets: assets.length,
      statusCounts,
      overdueActiveCount,
      utilization: { occupiedMs, capacityMs, ratio },
      calibrationDueSoon: { daysThreshold, count: dueSoonAssets.length, assets: dueSoonAssets.slice(0, 8) },
      topBusyAssets,
    }
  }
)

