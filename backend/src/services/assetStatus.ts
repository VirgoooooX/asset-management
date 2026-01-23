import { Database } from 'better-sqlite3'
import { parseIsoMs } from '../util/time.js'
import { publishAssetStatusChanged } from './events.js'

const isLogOccupying = (log: { status: string; start_time: string; end_time: string | null }, nowMs: number) => {
  if (log.status === 'completed') return false
  const startMs = parseIsoMs(log.start_time)
  if (startMs === null) return false
  if (startMs > nowMs) return false
  const endMs = parseIsoMs(log.end_time)
  if (endMs !== null && endMs <= nowMs) return false
  return true
}

export const recomputeChamberStatus = (db: Database, chamberId: string) => {
  const asset = db
    .prepare('select id, type, status from assets where id = ?')
    .get(chamberId) as { id: string; type: string; status: string } | undefined
  if (!asset) return { updated: false, targetStatus: null as string | null }
  if (asset.type !== 'chamber') return { updated: false, targetStatus: null as string | null }
  if (asset.status === 'maintenance') return { updated: false, targetStatus: 'maintenance' }

  const rows = db
    .prepare(
      "select status, start_time, end_time from usage_logs where chamber_id = ? and status in ('in-progress','not-started') order by created_at desc limit 100"
    )
    .all(chamberId) as { status: string; start_time: string; end_time: string | null }[]

  const nowMs = Date.now()
  const inUse = rows.some((r) => isLogOccupying(r, nowMs))
  const target = inUse ? 'in-use' : 'available'
  if (asset.status === target) return { updated: false, targetStatus: target }
  const now = new Date().toISOString()
  db.prepare('update assets set status = ?, updated_at = ? where id = ?').run(target, now, chamberId)
  publishAssetStatusChanged(chamberId, target, now)
  return { updated: true, targetStatus: target }
}
