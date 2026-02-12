import type { Asset, Project, UsageLog } from '../types'
import { calcCostCents, parseMs } from './costing'
import { getEffectiveHourlyRateCents, type RateSource } from './reportCosting'
import { getReportEndMs } from './reportEstimation'

export type CostLine = {
  logId: string
  projectId?: string
  projectName: string
  assetId: string
  assetName: string
  assetCategory: string
  startTime: string
  endTime: string
  billableHours: number
  hourlyRateCents: number
  rateSource: RateSource
  costCents: number
  estimated: boolean
  user: string
  notes?: string
  day: string
}

export type GroupBy = 'asset' | 'project' | 'user' | 'category'

export type CostGroup = {
  key: string
  label: string
  costCents: number
  billableHours: number
  logCount: number
  hourlyRateCents: number | null
  hasSnapshot: boolean
  hasFallback: boolean
  lines: CostLine[]
}

export type DailyPoint = { day: string; costCents: number; billableHours: number; logCount: number }

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const utcDayMs = (ms: number) => {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export const computeCostLines = (params: {
  usageLogs: UsageLog[]
  assetsById: Map<string, Asset>
  projectsById: Map<string, Project>
  rangeStartMs: number
  rangeEndMs: number
  projectId: string
  includeUnlinked: boolean
  includeInProgress: boolean
  nowMs: number
  unlinkedLabel: string
  uncategorizedLabel: string
}): { lines: CostLine[] } => {
  const lines: CostLine[] = []
  const nowMs = Number.isFinite(params.nowMs) ? params.nowMs : Date.now()

  for (const log of params.usageLogs) {
    const logProjectId = log.projectId
    if (params.projectId !== 'all') {
      if (logProjectId !== params.projectId) continue
    } else if (!params.includeUnlinked) {
      if (!logProjectId) continue
    }

    const rawStartMs = parseMs(log.startTime)
    if (rawStartMs === null) continue
    const end = getReportEndMs({
      endTime: log.endTime,
      status: log.status,
      includeInProgress: params.includeInProgress,
      nowMs,
      rangeEndMs: params.rangeEndMs,
    })
    if (!end) continue
    const rawEndMs = end.endMs

    const clippedStartMs = Math.max(rawStartMs, params.rangeStartMs)
    const clippedEndMs = Math.min(rawEndMs, params.rangeEndMs)
    if (!(clippedEndMs > clippedStartMs)) continue

    const durationMs = clippedEndMs - clippedStartMs
    const billableHours = Math.ceil(durationMs / (60 * 60 * 1000))

    const asset = params.assetsById.get(log.chamberId)
    const { hourlyRateCents, source: rateSource } = getEffectiveHourlyRateCents({
      usageLog: log,
      assetHourlyRateCents: asset?.hourlyRateCents ?? 0,
    })
    const costCents = calcCostCents(billableHours, hourlyRateCents)

    const projectName = logProjectId ? params.projectsById.get(logProjectId)?.name ?? logProjectId : params.unlinkedLabel
    const assetName = asset?.name ?? log.chamberId
    const assetCategory =
      typeof asset?.category === 'string' && asset.category.trim() ? asset.category.trim() : params.uncategorizedLabel

    lines.push({
      logId: log.id,
      projectId: logProjectId,
      projectName,
      assetId: log.chamberId,
      assetName,
      assetCategory,
      startTime: new Date(clippedStartMs).toISOString(),
      endTime: new Date(clippedEndMs).toISOString(),
      billableHours,
      hourlyRateCents,
      rateSource,
      costCents,
      estimated: end.estimated,
      user: log.user,
      notes: log.notes,
      day: isoDay(utcDayMs(clippedStartMs)),
    })
  }

  lines.sort((a, b) => (parseMs(b.startTime) ?? 0) - (parseMs(a.startTime) ?? 0))
  return { lines }
}

export const groupCostLines = (lines: CostLine[], groupBy: GroupBy): CostGroup[] => {
  const map = new Map<string, CostGroup & { rateCentsSet: Set<number> }>()
  for (const l of lines) {
    const key =
      groupBy === 'asset'
        ? l.assetId
        : groupBy === 'project'
          ? l.projectId ?? 'unlinked'
          : groupBy === 'user'
            ? l.user || '-'
            : l.assetCategory || 'Uncategorized'
    const label =
      groupBy === 'asset'
        ? l.assetName
        : groupBy === 'project'
          ? l.projectName
          : groupBy === 'user'
            ? l.user || '-'
            : l.assetCategory || 'Uncategorized'

    const prev =
      map.get(key) ??
      {
        key,
        label,
        costCents: 0,
        billableHours: 0,
        logCount: 0,
        hourlyRateCents: null,
        hasSnapshot: false,
        hasFallback: false,
        lines: [],
        rateCentsSet: new Set<number>(),
      }

    prev.costCents += l.costCents
    prev.billableHours += l.billableHours
    prev.logCount += 1
    prev.lines.push(l)
    prev.rateCentsSet.add(l.hourlyRateCents)
    if (l.rateSource === 'snapshot') prev.hasSnapshot = true
    if (l.rateSource === 'asset') prev.hasFallback = true
    map.set(key, prev)
  }

  const list = Array.from(map.values()).map((g) => {
    const hourlyRateCents = g.rateCentsSet.size === 1 ? Array.from(g.rateCentsSet.values())[0] : null
    return {
      key: g.key,
      label: g.label,
      costCents: g.costCents,
      billableHours: g.billableHours,
      logCount: g.logCount,
      hourlyRateCents,
      hasSnapshot: g.hasSnapshot,
      hasFallback: g.hasFallback,
      lines: g.lines.slice(),
    }
  })

  list.sort((a, b) => b.costCents - a.costCents)
  return list
}

export const buildDailySeries = (lines: CostLine[], rangeStartMs: number, rangeEndMs: number): DailyPoint[] => {
  const startDayMs = utcDayMs(Number.isFinite(rangeStartMs) ? rangeStartMs : Date.now())
  const endDayMs = utcDayMs(Number.isFinite(rangeEndMs) ? rangeEndMs : Date.now())
  const byDay = new Map<string, DailyPoint>()
  for (const l of lines) {
    const prev = byDay.get(l.day) ?? { day: l.day, costCents: 0, billableHours: 0, logCount: 0 }
    prev.costCents += l.costCents
    prev.billableHours += l.billableHours
    prev.logCount += 1
    byDay.set(l.day, prev)
  }

  const out: DailyPoint[] = []
  const oneDay = 24 * 60 * 60 * 1000
  for (let t = startDayMs; t <= endDayMs; t += oneDay) {
    const day = isoDay(t)
    out.push(byDay.get(day) ?? { day, costCents: 0, billableHours: 0, logCount: 0 })
  }
  return out
}
