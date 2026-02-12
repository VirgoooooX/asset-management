import type Database from 'better-sqlite3'

export type ReportGroupBy = 'asset' | 'project' | 'user' | 'category'

export type ProjectCostGroup = {
  key: string
  label: string
  costCents: number
  billableHours: number
  logCount: number
  hourlyRateCents: number | null
  hasSnapshot: boolean
  hasCategory: boolean
  hasAsset: boolean
  hasFallback: boolean
}

export type ProjectCostSeriesPoint = {
  day: string
  costCents: number
  billableHours: number
  logCount: number
}

export type ProjectCostLine = {
  logId: string
  projectId: string | null
  projectName: string
  assetId: string
  assetName: string
  assetCategory: string
  startTime: string
  endTime: string
  billableHours: number
  hourlyRateCents: number
  rateSource: 'snapshot' | 'category' | 'asset'
  costCents: number
  estimated: boolean
  user: string
  notes: string | null
}

type BaseParams = {
  rangeStartMs: number
  rangeEndMs: number
  projectId: string
  includeUnlinked: boolean
  includeInProgress: boolean
  nowMs: number
  unlinkedLabel: string
  uncategorizedLabel: string
}

const clampNow = (nowMs: number, rangeEndMs: number) => (nowMs < rangeEndMs ? nowMs : rangeEndMs)

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const buildBaseCte = (p: BaseParams) => {
  const nowClamped = clampNow(p.nowMs, p.rangeEndMs)
  const includeInProgress = p.includeInProgress ? 1 : 0
  const params: any[] = [
    includeInProgress,
    nowClamped,
    p.rangeEndMs,
    nowClamped,
    p.rangeEndMs,
    includeInProgress,
    p.uncategorizedLabel,
    p.rangeEndMs,
    p.rangeStartMs,
    includeInProgress,
    p.rangeStartMs,
    p.rangeStartMs,
    p.rangeEndMs,
    p.rangeEndMs,
  ]

  const where: string[] = []
  if (p.projectId !== 'all') {
    where.push('u.project_id = ?')
    params.push(p.projectId)
  } else if (!p.includeUnlinked) {
    where.push('u.project_id is not null')
  }

  const whereSql = where.length ? `and ${where.join(' and ')}` : ''

  const sql = `
    with base as (
      select
        u.id as log_id,
        u.project_id,
        u.chamber_id,
        u.user,
        u.status,
        u.notes,
        cast(strftime('%s', u.start_time) as integer) * 1000 as start_ms,
        case
          when u.end_time is not null then cast(strftime('%s', u.end_time) as integer) * 1000
          when ? = 1 and u.status in ('in-progress','overdue') then (case when ? < ? then ? else ? end)
          else null
        end as end_ms,
        case when u.end_time is null and ? = 1 and u.status in ('in-progress','overdue') then 1 else 0 end as estimated,
        a.id as asset_id,
        coalesce(a.name, u.chamber_id) as asset_name,
        case when a.category is null or trim(a.category) = '' then ? else a.category end as asset_category,
        (case when a.category is null or trim(a.category) = '' then '' else a.category end) as category_key,
        coalesce(a.hourly_rate_cents, 0) as asset_rate_cents,
        acr.hourly_rate_cents as category_rate_cents,
        u.hourly_rate_cents_snapshot as snapshot_rate_cents,
        p.name as project_name
      from usage_logs u
      left join assets a on a.id = u.chamber_id
      left join asset_category_rates acr on acr.category = (case when a.category is null or trim(a.category) = '' then '' else a.category end)
      left join projects p on p.id = u.project_id
      where
        cast(strftime('%s', u.start_time) as integer) * 1000 < ?
        and (
          (u.end_time is not null and cast(strftime('%s', u.end_time) as integer) * 1000 > ?)
          or (u.end_time is null and ? = 1 and u.status in ('in-progress','overdue'))
        )
        ${whereSql}
    ),
    clipped as (
      select
        *,
        case when start_ms > ? then start_ms else ? end as clip_start_ms,
        case when end_ms < ? then end_ms else ? end as clip_end_ms,
        coalesce(snapshot_rate_cents, category_rate_cents, asset_rate_cents, 0) as rate_cents,
        case
          when snapshot_rate_cents is not null then 'snapshot'
          when category_rate_cents is not null then 'category'
          else 'asset'
        end as rate_source,
        case when snapshot_rate_cents is not null then 1 else 0 end as has_snapshot,
        case when snapshot_rate_cents is null and category_rate_cents is not null then 1 else 0 end as has_category,
        case when snapshot_rate_cents is null and category_rate_cents is null then 1 else 0 end as has_asset
      from base
      where end_ms is not null
    ),
    billed as (
      select
        *,
        cast(((clip_end_ms - clip_start_ms) + 3599999) / 3600000 as integer) as billable_hours,
        cast(((clip_end_ms - clip_start_ms) + 3599999) / 3600000 as integer) * rate_cents as cost_cents
      from clipped
      where clip_end_ms > clip_start_ms
    )
  `

  return { sql, params }
}

export const queryProjectCostGroups = (db: Database.Database, p: BaseParams & { groupBy: ReportGroupBy }): ProjectCostGroup[] => {
  const { sql: cte, params } = buildBaseCte(p)

  const groupKeySql =
    p.groupBy === 'asset'
      ? 'asset_id'
      : p.groupBy === 'project'
        ? "coalesce(project_id, 'unlinked')"
        : p.groupBy === 'user'
          ? "case when user is null or user = '' then '-' else user end"
          : 'asset_category'
  const groupLabelSql =
    p.groupBy === 'asset'
      ? 'asset_name'
      : p.groupBy === 'project'
        ? `case when project_id is null then ? else coalesce(project_name, project_id) end`
        : p.groupBy === 'user'
          ? `case when user is null or user = '' then '-' else user end`
          : 'asset_category'

  const extraParams = p.groupBy === 'project' ? [p.unlinkedLabel] : []

  const rows = db
    .prepare(
      `
      ${cte}
      select
        ${groupKeySql} as key,
        ${groupLabelSql} as label,
        sum(cost_cents) as cost_cents,
        sum(billable_hours) as billable_hours,
        count(1) as log_count,
        min(rate_cents) as min_rate_cents,
        max(rate_cents) as max_rate_cents,
        max(has_snapshot) as has_snapshot,
        max(has_category) as has_category,
        max(has_asset) as has_asset,
        max(case when rate_source != 'snapshot' then 1 else 0 end) as has_fallback
      from billed
      group by 1,2
      order by cost_cents desc
      `
    )
    .all(...params, ...extraParams) as Array<any>

  return rows.map((r) => ({
    key: String(r.key),
    label: String(r.label),
    costCents: Number(r.cost_cents ?? 0),
    billableHours: Number(r.billable_hours ?? 0),
    logCount: Number(r.log_count ?? 0),
    hourlyRateCents: Number(r.min_rate_cents) === Number(r.max_rate_cents) ? Number(r.min_rate_cents ?? 0) : null,
    hasSnapshot: Boolean(r.has_snapshot),
    hasCategory: Boolean(r.has_category),
    hasAsset: Boolean(r.has_asset),
    hasFallback: Boolean(r.has_fallback),
  }))
}

export const queryProjectCostSeries = (db: Database.Database, p: Omit<BaseParams, 'unlinkedLabel' | 'uncategorizedLabel'>): ProjectCostSeriesPoint[] => {
  const base: BaseParams = {
    ...p,
    unlinkedLabel: 'Unlinked',
    uncategorizedLabel: 'Uncategorized',
  }
  const { sql: cte, params } = buildBaseCte(base)

  const rows = db
    .prepare(
      `
      ${cte}
      select
        strftime('%Y-%m-%d', clip_start_ms / 1000, 'unixepoch') as day,
        sum(cost_cents) as cost_cents,
        sum(billable_hours) as billable_hours,
        count(1) as log_count
      from billed
      group by 1
      order by day asc
      `
    )
    .all(...params) as Array<any>

  const map = new Map<string, ProjectCostSeriesPoint>()
  rows.forEach((r) => {
    const day = String(r.day)
    map.set(day, {
      day,
      costCents: Number(r.cost_cents ?? 0),
      billableHours: Number(r.billable_hours ?? 0),
      logCount: Number(r.log_count ?? 0),
    })
  })

  const out: ProjectCostSeriesPoint[] = []
  const startDayMs = Date.parse(`${utcDay(p.rangeStartMs)}T00:00:00.000Z`)
  const endDayMs = Date.parse(`${utcDay(p.rangeEndMs)}T00:00:00.000Z`)
  const oneDay = 24 * 60 * 60 * 1000
  for (let t = startDayMs; t <= endDayMs; t += oneDay) {
    const day = utcDay(t)
    out.push(map.get(day) ?? { day, costCents: 0, billableHours: 0, logCount: 0 })
  }
  return out
}

export const queryProjectCostLines = (db: Database.Database, p: BaseParams): ProjectCostLine[] => {
  const { sql: cte, params } = buildBaseCte(p)

  return queryProjectCostLinesFiltered(db, { ...p, groupBy: null, groupKey: null })
}

export const queryProjectCostLinesFiltered = (
  db: Database.Database,
  p: BaseParams & { groupBy: ReportGroupBy | null; groupKey: string | null }
): ProjectCostLine[] => {
  const { sql: cte, params } = buildBaseCte(p)

  const groupFilterExpr =
    p.groupBy === 'asset'
      ? 'asset_id'
      : p.groupBy === 'project'
        ? "coalesce(project_id, 'unlinked')"
        : p.groupBy === 'user'
          ? "case when user is null or user = '' then '-' else user end"
          : p.groupBy === 'category'
            ? 'asset_category'
            : null

  const whereSql = groupFilterExpr && p.groupKey ? `where ${groupFilterExpr} = ?` : ''
  const extraParams: any[] = [p.unlinkedLabel]
  if (whereSql) extraParams.push(p.groupKey)

  const rows = db
    .prepare(
      `
      ${cte}
      select
        log_id,
        project_id,
        case when project_id is null then ? else coalesce(project_name, project_id) end as project_name,
        asset_id,
        asset_name,
        asset_category,
        clip_start_ms,
        clip_end_ms,
        billable_hours,
        rate_cents,
        rate_source,
        cost_cents,
        estimated,
        user,
        notes
      from billed
      ${whereSql}
      order by clip_start_ms desc
      `
    )
    .all(...params, ...extraParams) as Array<any>

  return rows.map((r) => {
    const startMs = Number(r.clip_start_ms)
    const endMs = Number(r.clip_end_ms)
    return {
      logId: String(r.log_id),
      projectId: r.project_id === null ? null : String(r.project_id),
      projectName: String(r.project_name),
      assetId: String(r.asset_id),
      assetName: String(r.asset_name),
      assetCategory: String(r.asset_category),
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      billableHours: Number(r.billable_hours ?? 0),
      hourlyRateCents: Number(r.rate_cents ?? 0),
      rateSource: r.rate_source === 'snapshot' ? 'snapshot' : r.rate_source === 'category' ? 'category' : 'asset',
      costCents: Number(r.cost_cents ?? 0),
      estimated: Boolean(r.estimated),
      user: String(r.user ?? ''),
      notes: r.notes === null || typeof r.notes === 'undefined' ? null : String(r.notes),
    }
  })
}
