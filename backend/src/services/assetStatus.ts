import { Database } from 'better-sqlite3'
import { parseIsoMs } from '../util/time.js'

const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000

const isLogOccupying = (log: { status: string; start_time: string; end_time: string | null }, nowMs: number) => {
  if (log.status === 'completed') return false
  const startMs = parseIsoMs(log.start_time)
  if (startMs === null) return false
  if (startMs > nowMs) {
    if (log.status !== 'in-progress') return false
    if (startMs - nowMs > MAX_CLOCK_SKEW_MS) return false
  }
  return true
}

export const recomputeChamberStatus = (db: Database, chamberId: string) => {
  const asset = db
    .prepare('select id, type, status from assets where id = ?')
    .get(chamberId) as { id: string; type: string; status: string } | undefined
  if (!asset) return { updated: false, targetStatus: null as string | null, updatedAt: null as string | null }
  if (asset.type !== 'chamber') return { updated: false, targetStatus: null as string | null, updatedAt: null as string | null }
  if (asset.status === 'maintenance') return { updated: false, targetStatus: 'maintenance', updatedAt: null as string | null }

  const rows = db
    .prepare("select status, start_time, end_time from usage_logs where chamber_id = ? and status <> 'completed'")
    .all(chamberId) as { status: string; start_time: string; end_time: string | null }[]

  const nowMs = Date.now()
  const inUse = rows.some((r) => isLogOccupying(r, nowMs))
  const target = inUse ? 'in-use' : 'available'
  if (asset.status === target) return { updated: false, targetStatus: target, updatedAt: null as string | null }
  const now = new Date().toISOString()
  db.prepare('update assets set status = ?, updated_at = ? where id = ?').run(target, now, chamberId)
  return { updated: true, targetStatus: target, updatedAt: now }
}
