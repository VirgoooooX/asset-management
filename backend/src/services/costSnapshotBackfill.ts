import type Database from 'better-sqlite3'
import { computeCostSnapshot } from './costSnapshot.js'
import { ASSET_CATEGORY_KEY_SQL } from '../db/sqlHelpers.js'

export const backfillUsageLogCostSnapshots = (db: Database.Database, params?: { limit?: number }) => {
  const limit = typeof params?.limit === 'number' && Number.isFinite(params.limit) ? Math.floor(params.limit) : 2000
  const safeLimit = limit > 0 ? Math.min(5000, limit) : 2000

  const rows = db
    .prepare(
      `
      select
        u.id,
        u.chamber_id,
        u.start_time,
        u.end_time,
        coalesce(r.hourly_rate_cents, a.hourly_rate_cents, 0) as rate_cents
      from usage_logs u
      left join assets a on a.id = u.chamber_id
      left join asset_category_rates r on r.category = ${ASSET_CATEGORY_KEY_SQL}
      where
        u.status = 'completed'
        and u.end_time is not null
        and (
          u.hourly_rate_cents_snapshot is null
          or u.billable_hours_snapshot is null
          or u.cost_cents_snapshot is null
        )
      order by u.start_time asc
      limit ?
      `
    )
    .all(safeLimit) as Array<{ id: string; chamber_id: string; start_time: string; end_time: string; rate_cents?: number }>

  const updateStmt = db.prepare(
    `
    update usage_logs
    set
      hourly_rate_cents_snapshot = ?,
      billable_hours_snapshot = ?,
      cost_cents_snapshot = ?,
      snapshot_at = ?,
      snapshot_source = ?
    where id = ?
    `
  )

  const now = new Date().toISOString()
  let updated = 0

  db.transaction(() => {
    for (const r of rows) {
      const hourlyRateCents = typeof r.rate_cents === 'number' ? r.rate_cents : 0
      const snapshot = computeCostSnapshot({ startIso: r.start_time, endIso: r.end_time, hourlyRateCents })
      if (!snapshot) continue
      updateStmt.run(hourlyRateCents, snapshot.billableHours, snapshot.costCents, now, 'backfill', r.id)
      updated += 1
    }
  })()

  return { scanned: rows.length, updated }
}
