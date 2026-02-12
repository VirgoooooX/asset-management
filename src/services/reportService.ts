import { apiFetch } from './apiClient'

export type ProjectCostReportGroupBy = 'asset' | 'project' | 'user' | 'category'

export type ProjectCostReportGroup = {
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

export type ProjectCostReportSeriesPoint = {
  day: string
  costCents: number
  billableHours: number
  logCount: number
}

export type ProjectCostReportLine = {
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

export type ProjectCostReportResponse = {
  summary: {
    range: { startMs: number; endMs: number }
    totalCostCents: number
    totalBillableHours: number
    groupCount: number
    logCount: number
    groupBy: ProjectCostReportGroupBy
  }
  groups: ProjectCostReportGroup[]
  series: ProjectCostReportSeriesPoint[]
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (typeof v === 'undefined') return
    sp.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const fetchProjectCostReport = async (p: {
  rangeStartMs: number
  rangeEndMs: number
  projectId: string
  groupBy: ProjectCostReportGroupBy
  includeUnlinked: boolean
  includeInProgress: boolean
}): Promise<ProjectCostReportResponse> => {
  return await apiFetch<ProjectCostReportResponse>(
    `/api/reports/project-cost${qs({
      rangeStartMs: p.rangeStartMs,
      rangeEndMs: p.rangeEndMs,
      projectId: p.projectId,
      groupBy: p.groupBy,
      includeUnlinked: p.includeUnlinked,
      includeInProgress: p.includeInProgress,
    })}`
  )
}

export const fetchProjectCostLines = async (p: {
  rangeStartMs: number
  rangeEndMs: number
  projectId: string
  groupBy: ProjectCostReportGroupBy
  includeUnlinked: boolean
  includeInProgress: boolean
}): Promise<ProjectCostReportLine[]> => {
  const data = await apiFetch<{ items: ProjectCostReportLine[] }>(
    `/api/reports/project-cost/lines${qs({
      rangeStartMs: p.rangeStartMs,
      rangeEndMs: p.rangeEndMs,
      projectId: p.projectId,
      groupBy: p.groupBy,
      includeUnlinked: p.includeUnlinked,
      includeInProgress: p.includeInProgress,
    })}`
  )
  return Array.isArray(data.items) ? data.items : []
}

export const fetchProjectCostGroupLines = async (p: {
  rangeStartMs: number
  rangeEndMs: number
  projectId: string
  groupBy: ProjectCostReportGroupBy
  key: string
  includeUnlinked: boolean
  includeInProgress: boolean
}): Promise<ProjectCostReportLine[]> => {
  const data = await apiFetch<{ items: ProjectCostReportLine[] }>(
    `/api/reports/project-cost/group-lines${qs({
      rangeStartMs: p.rangeStartMs,
      rangeEndMs: p.rangeEndMs,
      projectId: p.projectId,
      groupBy: p.groupBy,
      key: p.key,
      includeUnlinked: p.includeUnlinked,
      includeInProgress: p.includeInProgress,
    })}`
  )
  return Array.isArray(data.items) ? data.items : []
}
