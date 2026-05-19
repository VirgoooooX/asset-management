import { Database } from 'better-sqlite3'
import {
  NotificationInput,
  createNotificationWithDeliveries,
  resolveNotificationUsers,
} from './notificationService.js'

type ScanOptions = {
  nowMs?: number
  calibrationDaysThreshold?: number
  longOccupancyHoursThreshold?: number
}

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const parseMs = (value: unknown): number | null => {
  if (typeof value !== 'string' || !value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

const create = (db: Database, input: NotificationInput) => {
  const users = resolveNotificationUsers(db, { type: input.type })
  return createNotificationWithDeliveries(db, input, { users })
}

export const scanNotificationConditions = (db: Database, options: ScanOptions = {}) => {
  const nowMs = options.nowMs ?? Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const today = dayKey(nowMs)
  const calibrationDays = Math.max(1, Math.floor(options.calibrationDaysThreshold ?? 30))
  const longHours = Math.max(1, Math.floor(options.longOccupancyHoursThreshold ?? 72))
  const createdIds: string[] = []

  const assets = db
    .prepare("select id, name, calibration_date from assets where type = 'chamber'")
    .all() as Array<{ id: string; name: string; calibration_date?: string | null }>

  for (const asset of assets) {
    const dueMs = parseMs(asset.calibration_date)
    if (dueMs === null) continue
    const daysUntil = Math.ceil((dueMs - nowMs) / (24 * 60 * 60 * 1000))
    if (daysUntil < 0 || daysUntil > calibrationDays) continue
    const result = create(db, {
      type: 'calibration_due',
      severity: daysUntil <= 7 ? 'P1' : 'P2',
      title: '校准即将到期',
      message: `${asset.name} 将在 ${Math.max(0, daysUntil)} 天内到期`,
      entityType: 'asset',
      entityId: asset.id,
      assetId: asset.id,
      assetName: asset.name,
      occurredAt: nowIso,
      url: '/calibrations',
      dedupeKey: `calibration_due:${asset.id}:${today}`,
    })
    if (result.created) createdIds.push(result.id)
  }

  const logs = db
    .prepare(
      [
        'select l.id, l.chamber_id, l.start_time, l.end_time, l.user, l.status, a.name as asset_name',
        'from usage_logs l',
        'left join assets a on a.id = l.chamber_id',
        "where l.status <> 'completed'",
      ].join(' ')
    )
    .all() as Array<{
      id: string
      chamber_id: string
      start_time: string
      end_time?: string | null
      user: string
      status: string
      asset_name?: string | null
    }>

  for (const log of logs) {
    const startMs = parseMs(log.start_time)
    if (startMs === null || startMs > nowMs) continue
    const endMs = parseMs(log.end_time)
    const assetName = log.asset_name ?? log.chamber_id
    if (endMs !== null && endMs < nowMs) {
      const result = create(db, {
        type: 'usage_overdue',
        severity: 'P1',
        title: '使用记录已逾期',
        message: `${assetName} 的使用记录已超过结束时间`,
        entityType: 'usage_log',
        entityId: log.id,
        assetId: log.chamber_id,
        assetName,
        occurredAt: nowIso,
        url: '/alerts',
        dedupeKey: `usage_overdue:${log.id}:${today}`,
      })
      if (result.created) createdIds.push(result.id)
      continue
    }

    const occupiedHours = (nowMs - startMs) / (60 * 60 * 1000)
    if (occupiedHours >= longHours) {
      const result = create(db, {
        type: 'usage_long',
        severity: occupiedHours >= longHours * 2 ? 'P1' : 'P2',
        title: '设备长时间占用',
        message: `${assetName} 已持续占用 ${Math.floor(occupiedHours)} 小时`,
        entityType: 'usage_log',
        entityId: log.id,
        assetId: log.chamber_id,
        assetName,
        occurredAt: nowIso,
        url: '/alerts',
        dedupeKey: `usage_long:${log.id}:${today}`,
      })
      if (result.created) createdIds.push(result.id)
    }
  }

  return { created: createdIds.length, ids: createdIds }
}
