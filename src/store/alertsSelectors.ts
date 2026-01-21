import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from './index'
import type { Asset, UsageLog } from '../types'
import { getEffectiveUsageLogStatus } from '../utils/statusHelpers'

export type AlertSeverity = 'P1' | 'P2'
export type AlertType = 'calibration-due' | 'usage-overdue' | 'usage-long'

export interface DerivedAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  assetId: string
  assetName: string
  title: string
  detail: string
  occurredAtMs: number
  relatedLogId?: string
}

const selectAssets = (state: RootState) => state.assets.assets
const selectUsageLogs = (state: RootState) => state.usageLogs.usageLogs
const selectSettings = (state: RootState) => state.settings

const parseMs = (value: string | undefined): number | null => {
  if (!value) return null
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return null
  return ms
}

const getUsageLogEndMs = (log: UsageLog, nowMs: number): number => {
  const end = parseMs(log.endTime)
  if (end !== null) return end
  const effective = getEffectiveUsageLogStatus(log)
  if (effective === 'in-progress' || effective === 'overdue') return nowMs
  const start = parseMs(log.startTime)
  if (start === null) return nowMs
  return start + 60 * 60 * 1000
}

export const selectDerivedAlerts = createSelector(
  [
    selectAssets,
    selectUsageLogs,
    selectSettings,
    (_state: RootState, nowMs: number) => nowMs,
  ],
  (assets, usageLogs, settings, nowMs): DerivedAlert[] => {
    const chamberAssets = assets.filter((a) => a.type === 'chamber')
    const assetById = new Map<string, Asset>()
    chamberAssets.forEach((a) => assetById.set(a.id, a))

    const alerts: DerivedAlert[] = []

    const calibrationDays = settings.alerts.calibrationDaysThreshold
    const calibrationThresholdMs = calibrationDays * 24 * 60 * 60 * 1000

    for (const asset of chamberAssets) {
      const calibrationMs = parseMs(asset.calibrationDate)
      if (calibrationMs === null) continue
      const delta = calibrationMs - nowMs
      if (delta < 0) continue
      if (delta > calibrationThresholdMs) continue

      alerts.push({
        id: `calibration-due:${asset.id}:${calibrationMs}`,
        type: 'calibration-due',
        severity: delta <= 7 * 24 * 60 * 60 * 1000 ? 'P1' : 'P2',
        assetId: asset.id,
        assetName: asset.name,
        title: '校准即将到期',
        detail: `到期时间: ${new Date(calibrationMs).toLocaleString()}`,
        occurredAtMs: calibrationMs,
      })
    }

    const longHours = settings.alerts.longOccupancyHoursThreshold
    const longThresholdMs = longHours * 60 * 60 * 1000

    for (const log of usageLogs) {
      const asset = assetById.get(log.chamberId)
      if (!asset) continue
      const startMs = parseMs(log.startTime)
      if (startMs === null) continue
      const endMs = getUsageLogEndMs(log, nowMs)
      const effective = getEffectiveUsageLogStatus(log)

      if (effective === 'overdue') {
        alerts.push({
          id: `usage-overdue:${log.id}`,
          type: 'usage-overdue',
          severity: 'P1',
          assetId: asset.id,
          assetName: asset.name,
          title: '使用记录已逾期',
          detail: `开始: ${new Date(startMs).toLocaleString()}，当前状态: ${effective}`,
          occurredAtMs: endMs,
          relatedLogId: log.id,
        })
      }

      if (effective === 'in-progress' || effective === 'overdue') {
        const duration = nowMs - startMs
        if (duration >= longThresholdMs) {
          alerts.push({
            id: `usage-long:${log.id}`,
            type: 'usage-long',
            severity: duration >= longThresholdMs * 2 ? 'P1' : 'P2',
            assetId: asset.id,
            assetName: asset.name,
            title: '长时间占用',
            detail: `已持续 ${Math.floor(duration / (60 * 60 * 1000))} 小时（阈值 ${longHours} 小时）`,
            occurredAtMs: nowMs,
            relatedLogId: log.id,
          })
        }
      }
    }

    return alerts.sort((a, b) => {
      const sev = (s: AlertSeverity) => (s === 'P1' ? 0 : 1)
      const diff = sev(a.severity) - sev(b.severity)
      if (diff !== 0) return diff
      return b.occurredAtMs - a.occurredAtMs
    })
  }
)

