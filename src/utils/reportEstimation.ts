export const getReportEndMs = (params: {
  endTime?: string
  status: 'not-started' | 'in-progress' | 'completed' | 'overdue'
  includeInProgress: boolean
  nowMs: number
  rangeEndMs: number
}): { endMs: number; estimated: boolean } | null => {
  const rawEndMs = params.endTime ? Date.parse(params.endTime) : Number.NaN
  if (Number.isFinite(rawEndMs)) {
    return { endMs: rawEndMs, estimated: false }
  }
  if (!params.includeInProgress) return null
  if (params.status !== 'in-progress' && params.status !== 'overdue') return null
  const nowMs = Number.isFinite(params.nowMs) ? params.nowMs : Date.now()
  const rangeEndMs = Number.isFinite(params.rangeEndMs) ? params.rangeEndMs : nowMs
  return { endMs: Math.min(nowMs, rangeEndMs), estimated: true }
}

