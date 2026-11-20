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

type RawCandidateRow = {
  log_id: string
  project_id: string | null
  chamber_id: string
  user: string
  status: string
  notes: string | null
  start_time: string
  end_time: string | null
  asset_name: string
  raw_category: string | null
  asset_rate_cents: number
  category_rate_cents: number | null
  snapshot_rate_cents: number | null
  project_name: string | null
}

type BilledLineInternal = ProjectCostLine & {
  clipStartMs: number
  clipEndMs: number
  day: string
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const TZ_PAD_MS = 15 * HOUR_MS

const clampNow = (nowMs: number, rangeEndMs: number) => (nowMs < rangeEndMs ? nowMs : rangeEndMs)

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const getGroupKeyAndLabel = (line: BilledLineInternal, groupBy: ReportGroupBy, unlinkedLabel: string) => {
  if (groupBy === 'asset') return { key: line.assetId, label: line.assetName }
  if (groupBy === 'project') {
    return {
      key: line.projectId ?? 'unlinked',
      label: line.projectId ? line.projectName : unlinkedLabel,
    }
  }
  if (groupBy === 'user') {
    const userLabel = line.user ? line.user : '-'
    return { key: userLabel, label: userLabel }
  }
  return { key: line.assetCategory, label: line.assetCategory }
}

const fetchBilledLines = (db: Database.Database, p: BaseParams): BilledLineInternal[] => {
  const paddedEndIso = new Date(p.rangeEndMs + TZ_PAD_MS).toISOString()
  const paddedStartIso = new Date(Math.max(0, p.rangeStartMs - TZ_PAD_MS)).toISOString()
  const includeInProgress = p.includeInProgress ? 1 : 0

  const params: Array<string | number> = [paddedEndIso, paddedStartIso, includeInProgress]
  const where: string[] = []
  if (p.projectId !== 'all') {
    where.push('u.project_id = ?')
    params.push(p.projectId)
  } else if (!p.includeUnlinked) {
    where.push('u.project_id is not null')
  }
  const extraWhereSql = where.length ? `and ${where.join(' and ')}` : ''

  const rows = db
    .prepare(
      `
      select
        u.id as log_id,
        u.project_id,
        u.chamber_id,
        u.user,
        u.status,
        u.notes,
        u.start_time,
        u.end_time,
        coalesce(a.name, u.chamber_id) as asset_name,
        a.category as raw_category,
        coalesce(a.hourly_rate_cents, 0) as asset_rate_cents,
        acr.hourly_rate_cents as category_rate_cents,
        u.hourly_rate_cents_snapshot as snapshot_rate_cents,
        p.name as project_name
      from usage_logs u
      left join assets a on a.id = u.chamber_id
      left join asset_category_rates acr on acr.category = (case when a.category is null or trim(a.category) = '' then '' else trim(a.category) end)
      left join projects p on p.id = u.project_id
      where
        u.start_time < ?
        and (
          (u.end_time is not null and u.end_time > ?)
          or (u.end_time is null and ? = 1 and u.status in ('in-progress','overdue'))
        )
        ${extraWhereSql}
      `
    )
    .all(...params) as RawCandidateRow[]

  const nowClamped = clampNow(p.nowMs, p.rangeEndMs)
  const billed: BilledLineInternal[] = []

  for (const r of rows) {
    const startMs = Date.parse(r.start_time)
    if (!Number.isFinite(startMs)) continue

    let endMs: number
    let estimated = false
    if (r.end_time !== null && r.end_time !== undefined) {
      endMs = Date.parse(r.end_time)
      if (!Number.isFinite(endMs)) continue
    } else if (p.includeInProgress && (r.status === 'in-progress' || r.status === 'overdue')) {
      endMs = nowClamped
      estimated = true
    } else {
      continue
    }

    const clipStartMs = Math.max(startMs, p.rangeStartMs)
    const clipEndMs = Math.min(endMs, p.rangeEndMs)
    if (!(clipEndMs > clipStartMs)) continue

    const billableHours = Math.ceil((clipEndMs - clipStartMs) / HOUR_MS)

    let rateCents = 0
    let rateSource: 'snapshot' | 'category' | 'asset' = 'asset'
    if (typeof r.snapshot_rate_cents === 'number' && Number.isFinite(r.snapshot_rate_cents)) {
      rateCents = Math.max(0, Math.round(r.snapshot_rate_cents))
      rateSource = 'snapshot'
    } else if (typeof r.category_rate_cents === 'number' && Number.isFinite(r.category_rate_cents)) {
      rateCents = Math.max(0, Math.round(r.category_rate_cents))
      rateSource = 'category'
    } else {
      rateCents = Math.max(0, Math.round(Number(r.asset_rate_cents ?? 0)))
      rateSource = 'asset'
    }

    const costCents = billableHours * rateCents
    const trimmedCategory = typeof r.raw_category === 'string' ? r.raw_category.trim() : ''
    const assetCategory = trimmedCategory || p.uncategorizedLabel
    const projectId = r.project_id === null || typeof r.project_id === 'undefined' ? null : String(r.project_id)
    const projectName = projectId ? String(r.project_name ?? projectId) : p.unlinkedLabel

    billed.push({
      logId: String(r.log_id),
      projectId,
      projectName,
      assetId: String(r.chamber_id),
      assetName: String(r.asset_name ?? r.chamber_id),
      assetCategory,
      startTime: new Date(clipStartMs).toISOString(),
      endTime: new Date(clipEndMs).toISOString(),
      billableHours,
      hourlyRateCents: rateCents,
      rateSource,
      costCents,
      estimated,
      user: String(r.user ?? ''),
      notes: r.notes === null || typeof r.notes === 'undefined' ? null : String(r.notes),
      clipStartMs,
      clipEndMs,
      day: utcDay(clipStartMs),
    })
  }

  return billed
}

const aggregateGroups = (billed: BilledLineInternal[], groupBy: ReportGroupBy, unlinkedLabel: string): ProjectCostGroup[] => {
  const map = new Map<
    string,
    {
      key: string
      label: string
      costCents: number
      billableHours: number
      logCount: number
      minRateCents: number
      maxRateCents: number
      hasSnapshot: boolean
      hasCategory: boolean
      hasAsset: boolean
      hasFallback: boolean
    }
  >()

  for (const l of billed) {
    const { key, label } = getGroupKeyAndLabel(l, groupBy, unlinkedLabel)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        key,
        label,
        costCents: l.costCents,
        billableHours: l.billableHours,
        logCount: 1,
        minRateCents: l.hourlyRateCents,
        maxRateCents: l.hourlyRateCents,
        hasSnapshot: l.rateSource === 'snapshot',
        hasCategory: l.rateSource === 'category',
        hasAsset: l.rateSource === 'asset',
        hasFallback: l.rateSource !== 'snapshot',
      })
      continue
    }
    existing.costCents += l.costCents
    existing.billableHours += l.billableHours
    existing.logCount += 1
    if (l.hourlyRateCents < existing.minRateCents) existing.minRateCents = l.hourlyRateCents
    if (l.hourlyRateCents > existing.maxRateCents) existing.maxRateCents = l.hourlyRateCents
    if (l.rateSource === 'snapshot') existing.hasSnapshot = true
    if (l.rateSource === 'category') existing.hasCategory = true
    if (l.rateSource === 'asset') existing.hasAsset = true
    if (l.rateSource !== 'snapshot') existing.hasFallback = true
  }

  return Array.from(map.values())
    .map((g) => ({
      key: g.key,
      label: g.label,
      costCents: g.costCents,
      billableHours: g.billableHours,
      logCount: g.logCount,
      hourlyRateCents: g.minRateCents === g.maxRateCents ? g.minRateCents : null,
      hasSnapshot: g.hasSnapshot,
      hasCategory: g.hasCategory,
      hasAsset: g.hasAsset,
      hasFallback: g.hasFallback,
    }))
    .sort((a, b) => b.costCents - a.costCents)
}

const aggregateSeries = (billed: BilledLineInternal[], rangeStartMs: number, rangeEndMs: number): ProjectCostSeriesPoint[] => {
  const byDay = new Map<string, ProjectCostSeriesPoint>()
  for (const l of billed) {
    const prev = byDay.get(l.day)
    if (!prev) {
      byDay.set(l.day, { day: l.day, costCents: l.costCents, billableHours: l.billableHours, logCount: 1 })
    } else {
      prev.costCents += l.costCents
      prev.billableHours += l.billableHours
      prev.logCount += 1
    }
  }

  const out: ProjectCostSeriesPoint[] = []
  const startDayMs = Date.parse(`${utcDay(rangeStartMs)}T00:00:00.000Z`)
  const endDayMs = Date.parse(`${utcDay(rangeEndMs)}T00:00:00.000Z`)
  for (let t = startDayMs; t <= endDayMs; t += DAY_MS) {
    const day = utcDay(t)
    out.push(byDay.get(day) ?? { day, costCents: 0, billableHours: 0, logCount: 0 })
  }
  return out
}

const toPublicLine = ({ clipStartMs: _cs, clipEndMs: _ce, day: _d, ...rest }: BilledLineInternal): ProjectCostLine => rest

export const queryProjectCostReport = (
  db: Database.Database,
  p: BaseParams & { groupBy: ReportGroupBy }
): { groups: ProjectCostGroup[]; series: ProjectCostSeriesPoint[] } => {
  const billed = fetchBilledLines(db, p)
  return {
    groups: aggregateGroups(billed, p.groupBy, p.unlinkedLabel),
    series: aggregateSeries(billed, p.rangeStartMs, p.rangeEndMs),
  }
}

export const queryProjectCostGroups = (db: Database.Database, p: BaseParams & { groupBy: ReportGroupBy }): ProjectCostGroup[] => {
  const billed = fetchBilledLines(db, p)
  return aggregateGroups(billed, p.groupBy, p.unlinkedLabel)
}

export const queryProjectCostSeries = (
  db: Database.Database,
  p: Omit<BaseParams, 'unlinkedLabel' | 'uncategorizedLabel'>
): ProjectCostSeriesPoint[] => {
  const billed = fetchBilledLines(db, {
    ...p,
    unlinkedLabel: 'Unlinked',
    uncategorizedLabel: 'Uncategorized',
  })
  return aggregateSeries(billed, p.rangeStartMs, p.rangeEndMs)
}

export const queryProjectCostLines = (db: Database.Database, p: BaseParams): ProjectCostLine[] => {
  return queryProjectCostLinesFiltered(db, { ...p, groupBy: null, groupKey: null })
}

export const queryProjectCostLinesFiltered = (
  db: Database.Database,
  p: BaseParams & { groupBy: ReportGroupBy | null; groupKey: string | null }
): ProjectCostLine[] => {
  const billed = fetchBilledLines(db, p)
  const filtered =
    p.groupBy && p.groupKey
      ? billed.filter((l) => getGroupKeyAndLabel(l, p.groupBy!, p.unlinkedLabel).key === p.groupKey)
      : billed

  filtered.sort((a, b) => b.clipStartMs - a.clipStartMs)
  return filtered.map(toPublicLine)
}
