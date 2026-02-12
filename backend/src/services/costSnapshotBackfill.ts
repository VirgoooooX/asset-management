import { computeCostSnapshot } from './costSnapshot.js'

export const backfillUsageLogCostSnapshots = (db: any, params?: { limit?: number }) => {
  const limit = typeof params?.limit === 'number' && Number.isFinite(params.limit) ? Math.floor(params.limit) : 2000
  const safeLimit = limit > 0 ? Math.min(5000, limit) : 2000

  const rows = db
    .prepare(
      `
      select id, chamber_id, start_time, end_time
      from usage_logs
      where
        status = 'completed'
        and end_time is not null
        and (
          hourly_rate_cents_snapshot is null
          or billable_hours_snapshot is null
          or cost_cents_snapshot is null
        )
      order by start_time asc
      limit ?
      `
    )
    .all(safeLimit) as Array<any>

  const getRateStmt = db.prepare(
    `
    select
      coalesce(r.hourly_rate_cents, a.hourly_rate_cents, 0) as rate_cents
    from assets a
    left join asset_category_rates r on r.category = (case when a.category is null or trim(a.category) = '' then '' else a.category end)
    where a.id = ?
    `
  )

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
      const rateRow = getRateStmt.get(r.chamber_id) as { rate_cents?: number } | undefined
      const hourlyRateCents = typeof rateRow?.rate_cents === 'number' ? rateRow.rate_cents : 0
      const snapshot = computeCostSnapshot({ startIso: r.start_time, endIso: r.end_time, hourlyRateCents })
      if (!snapshot) continue
      updateStmt.run(hourlyRateCents, snapshot.billableHours, snapshot.costCents, now, 'backfill', r.id)
      updated += 1
    }
  })()

  return { scanned: rows.length, updated }
}

