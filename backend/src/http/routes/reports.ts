import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../../db/db.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { queryProjectCostGroups, queryProjectCostLines, queryProjectCostLinesFiltered, queryProjectCostSeries } from '../../services/projectCostReport.js'

export const reportsRouter = Router()

const parseBool = (v: unknown) => {
  if (typeof v !== 'string') return false
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes'
}

const projectCostQuerySchema = z.object({
  rangeStartMs: z.coerce.number().int().nonnegative(),
  rangeEndMs: z.coerce.number().int().nonnegative(),
  projectId: z.string().min(1).default('all'),
  groupBy: z.enum(['asset', 'project', 'user', 'category']).default('asset'),
  includeUnlinked: z.string().optional(),
  includeInProgress: z.string().optional(),
})

reportsRouter.get('/project-cost', requireAuth, (req, res) => {
  const parsed = projectCostQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_query' })
  const q = parsed.data
  if (q.rangeEndMs < q.rangeStartMs) return res.status(400).json({ error: 'invalid_range' })

  const db = getDb()
  const nowMs = Date.now()
  const includeUnlinked = parseBool(q.includeUnlinked)
  const includeInProgress = parseBool(q.includeInProgress)
  const groups = queryProjectCostGroups(db, {
    groupBy: q.groupBy,
    rangeStartMs: q.rangeStartMs,
    rangeEndMs: q.rangeEndMs,
    projectId: q.projectId,
    includeUnlinked,
    includeInProgress,
    nowMs,
    unlinkedLabel: 'Unlinked',
    uncategorizedLabel: 'Uncategorized',
  })
  const series = queryProjectCostSeries(db, {
    rangeStartMs: q.rangeStartMs,
    rangeEndMs: q.rangeEndMs,
    projectId: q.projectId,
    includeUnlinked,
    includeInProgress,
    nowMs,
  })

  const totalCostCents = groups.reduce((sum, g) => sum + g.costCents, 0)
  const totalBillableHours = groups.reduce((sum, g) => sum + g.billableHours, 0)
  const logCount = groups.reduce((sum, g) => sum + g.logCount, 0)

  res.json({
    summary: {
      range: { startMs: q.rangeStartMs, endMs: q.rangeEndMs },
      totalCostCents,
      totalBillableHours,
      groupCount: groups.length,
      logCount,
      groupBy: q.groupBy,
    },
    groups,
    series,
  })
})

reportsRouter.get('/project-cost/lines', requireAuth, (req, res) => {
  const parsed = projectCostQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_query' })
  const q = parsed.data
  if (q.rangeEndMs < q.rangeStartMs) return res.status(400).json({ error: 'invalid_range' })

  const db = getDb()
  const nowMs = Date.now()
  const includeUnlinked = parseBool(q.includeUnlinked)
  const includeInProgress = parseBool(q.includeInProgress)
  const lines = queryProjectCostLines(db, {
    rangeStartMs: q.rangeStartMs,
    rangeEndMs: q.rangeEndMs,
    projectId: q.projectId,
    includeUnlinked,
    includeInProgress,
    nowMs,
    unlinkedLabel: 'Unlinked',
    uncategorizedLabel: 'Uncategorized',
  })
  res.json({ items: lines })
})

reportsRouter.get('/project-cost/group-lines', requireAuth, (req, res) => {
  const parsed = projectCostQuerySchema.extend({ key: z.string().min(1) }).safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_query' })
  const q = parsed.data
  if (q.rangeEndMs < q.rangeStartMs) return res.status(400).json({ error: 'invalid_range' })

  const db = getDb()
  const nowMs = Date.now()
  const includeUnlinked = parseBool(q.includeUnlinked)
  const includeInProgress = parseBool(q.includeInProgress)
  const lines = queryProjectCostLinesFiltered(db, {
    rangeStartMs: q.rangeStartMs,
    rangeEndMs: q.rangeEndMs,
    projectId: q.projectId,
    includeUnlinked,
    includeInProgress,
    nowMs,
    unlinkedLabel: 'Unlinked',
    uncategorizedLabel: 'Uncategorized',
    groupBy: q.groupBy,
    groupKey: q.key,
  })
  res.json({ items: lines })
})

