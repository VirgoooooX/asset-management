import type Database from 'better-sqlite3'
import { computeCostSnapshot } from '../services/costSnapshot.js'

export const ASSET_CATEGORY_KEY_SQL =
  "(case when a.category is null or trim(a.category) = '' then '' else trim(a.category) end)"

export type PatchFieldSpec = {
  column: string
  json?: boolean
  nullable?: boolean
  nullFallback?: unknown
}

export const buildPatchSet = (
  data: Record<string, unknown>,
  specs: Record<string, PatchFieldSpec>,
  extra?: Array<{ column: string; value: unknown }>
): { sets: string[]; params: unknown[] } => {
  const sets: string[] = []
  const params: unknown[] = []

  for (const [key, spec] of Object.entries(specs)) {
    const val = data[key]
    if (val === undefined) continue
    sets.push(`${spec.column} = ?`)
    if (val === null) {
      if (spec.nullFallback !== undefined) {
        params.push(spec.json ? JSON.stringify(spec.nullFallback) : spec.nullFallback)
      } else {
        params.push(null)
      }
      continue
    }
    if (spec.json) {
      params.push(JSON.stringify(val))
    } else if (spec.nullable) {
      params.push(val ?? null)
    } else {
      params.push(val)
    }
  }

  if (extra) {
    for (const item of extra) {
      sets.push(`${item.column} = ?`)
      params.push(item.value)
    }
  }

  return { sets, params }
}

export const getEffectiveAssetRateCents = (db: Database.Database, chamberId: string): number => {
  const row = db
    .prepare(
      `
      select
        coalesce(r.hourly_rate_cents, a.hourly_rate_cents, 0) as rate_cents
      from assets a
      left join asset_category_rates r on r.category = ${ASSET_CATEGORY_KEY_SQL}
      where a.id = ?
      `
    )
    .get(chamberId) as { rate_cents?: number } | undefined
  return typeof row?.rate_cents === 'number' ? row.rate_cents : 0
}

export const writeUsageLogCostSnapshot = (
  db: Database.Database,
  logId: string,
  source: 'at_completion' | 'recompute' | 'backfill'
) => {
  const row = db
    .prepare(
      'select id, chamber_id, start_time, end_time, status, hourly_rate_cents_snapshot, billable_hours_snapshot, cost_cents_snapshot from usage_logs where id = ?'
    )
    .get(logId) as
    | {
        id: string
        chamber_id: string
        start_time: string
        end_time: string | null
        status: string
        hourly_rate_cents_snapshot: number | null
        billable_hours_snapshot: number | null
        cost_cents_snapshot: number | null
      }
    | undefined
  if (!row || row.status !== 'completed' || !row.end_time) {
    return { updated: false as const }
  }

  const hourlyRateCents = getEffectiveAssetRateCents(db, row.chamber_id)
  const snapshot = computeCostSnapshot({
    startIso: row.start_time,
    endIso: row.end_time,
    hourlyRateCents,
  })
  if (!snapshot) return { updated: false as const }

  const next = {
    hourlyRateCentsSnapshot: hourlyRateCents,
    billableHoursSnapshot: snapshot.billableHours,
    costCentsSnapshot: snapshot.costCents,
  }

  const prev = {
    hourlyRateCentsSnapshot: typeof row.hourly_rate_cents_snapshot === 'number' ? row.hourly_rate_cents_snapshot : null,
    billableHoursSnapshot: typeof row.billable_hours_snapshot === 'number' ? row.billable_hours_snapshot : null,
    costCentsSnapshot: typeof row.cost_cents_snapshot === 'number' ? row.cost_cents_snapshot : null,
  }

  if (
    prev.hourlyRateCentsSnapshot === next.hourlyRateCentsSnapshot &&
    prev.billableHoursSnapshot === next.billableHoursSnapshot &&
    prev.costCentsSnapshot === next.costCentsSnapshot
  ) {
    return { updated: false as const }
  }

  const now = new Date().toISOString()
  db.prepare(
    'update usage_logs set hourly_rate_cents_snapshot = ?, billable_hours_snapshot = ?, cost_cents_snapshot = ?, snapshot_at = ?, snapshot_source = ? where id = ?'
  ).run(next.hourlyRateCentsSnapshot, next.billableHoursSnapshot, next.costCentsSnapshot, now, source, logId)

  return {
    updated: true as const,
    prev,
    next,
    snapshotAt: now,
    snapshotSource: source,
  }
}
