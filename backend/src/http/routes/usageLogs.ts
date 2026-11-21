import { Router, type Request } from 'express'
import { z } from 'zod'
import type Database from 'better-sqlite3'
import { randomToken } from '../../util/crypto.js'
import { parseJsonOr } from '../../util/json.js'
import { parseIsoMs } from '../../util/time.js'
import { getDb } from '../../db/db.js'
import { buildPatchSet, writeUsageLogCostSnapshot, type PatchFieldSpec } from '../../db/sqlHelpers.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireManager } from '../middlewares/requireManager.js'
import { validateBody, validateQuery } from '../middlewares/validate.js'
import { paginationQueryShape, usageLogStatusSchema } from '../schemas.js'
import { recomputeChamberStatus } from '../../services/assetStatus.js'
import { publishAssetStatusChanged, publishUsageLogChanged } from '../../services/events.js'
import { writeAuditFromReq } from '../../services/auditLog.js'
import type { UsageLogRow } from '../../types.js'

export const usageLogsRouter = Router()

const CLOCK_SKEW_ALLOW_MS = 2 * 60 * 1000

const usageLogCreateSchema = z.object({
  chamberId: z.string().min(1),
  projectId: z.string().optional(),
  testProjectId: z.string().optional(),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  user: z.string().min(1),
  status: usageLogStatusSchema,
  notes: z.string().optional(),
  selectedConfigIds: z.array(z.string()).optional(),
  selectedWaterfall: z.string().optional(),
})

const usageLogPatchSchema = z.object({
  chamberId: z.string().min(1).optional(),
  projectId: z.string().optional().nullable(),
  testProjectId: z.string().optional().nullable(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().optional().nullable(),
  user: z.string().min(1).optional(),
  status: usageLogStatusSchema.optional(),
  notes: z.string().optional().nullable(),
  selectedConfigIds: z.array(z.string()).optional().nullable(),
  selectedWaterfall: z.string().optional().nullable(),
})

const USAGE_LOG_PATCH_SPECS: Record<string, PatchFieldSpec> = {
  chamberId: { column: 'chamber_id' },
  projectId: { column: 'project_id', nullable: true },
  testProjectId: { column: 'test_project_id', nullable: true },
  startTime: { column: 'start_time' },
  endTime: { column: 'end_time', nullable: true },
  user: { column: 'user' },
  status: { column: 'status' },
  notes: { column: 'notes', nullable: true },
  selectedConfigIds: { column: 'selected_config_ids', json: true, nullFallback: [] },
  selectedWaterfall: { column: 'selected_waterfall', nullable: true },
}

const mapUsageLogRow = (r: UsageLogRow) => ({
  id: r.id,
  chamberId: r.chamber_id,
  projectId: r.project_id ?? undefined,
  testProjectId: r.test_project_id ?? undefined,
  startTime: r.start_time,
  endTime: r.end_time ?? undefined,
  user: r.user,
  status: r.status,
  notes: r.notes ?? undefined,
  selectedConfigIds: parseJsonOr<string[]>(r.selected_config_ids, []).filter((v) => typeof v === 'string'),
  selectedWaterfall: r.selected_waterfall ?? undefined,
  hourlyRateCentsSnapshot: typeof r.hourly_rate_cents_snapshot === 'number' ? r.hourly_rate_cents_snapshot : undefined,
  billableHoursSnapshot: typeof r.billable_hours_snapshot === 'number' ? r.billable_hours_snapshot : undefined,
  costCentsSnapshot: typeof r.cost_cents_snapshot === 'number' ? r.cost_cents_snapshot : undefined,
  snapshotAt: r.snapshot_at ?? undefined,
  snapshotSource: r.snapshot_source ?? undefined,
  createdAt: r.created_at,
})

const auditSummary = (r: UsageLogRow) => ({
  chamberId: r.chamber_id,
  projectId: r.project_id ?? null,
  testProjectId: r.test_project_id ?? null,
  startTime: r.start_time,
  endTime: r.end_time ?? null,
  user: r.user,
  status: r.status,
  notes: r.notes ?? null,
})

const ensureChamberUsable = (db: Database.Database, chamberId: string) => {
  const asset = db.prepare('select id, status from assets where id = ?').get(chamberId) as
    | { id: string; status: string }
    | undefined
  if (!asset) return { ok: false as const, error: 'asset_not_found' as const }
  if (asset.status === 'maintenance') return { ok: false as const, error: 'asset_in_maintenance' as const }
  return { ok: true as const }
}

type UsageLogScheduleConflict = {
  error: 'usage_log_overlap' | 'usage_log_active_conflict'
  conflict: {
    id: string
    startTime: string
    endTime: string | null
    user: string
    status: string
  }
}

const findChamberScheduleConflict = (
  db: Database.Database,
  params: {
    chamberId: string
    startMs: number
    endMs: number | null
    status: UsageLogRow['status']
    nowMs: number
    excludeId?: string
  }
): UsageLogScheduleConflict | null => {
  const rows = (
    params.excludeId
      ? db
          .prepare('select id, start_time, end_time, user, status from usage_logs where chamber_id = ? and id != ?')
          .all(params.chamberId, params.excludeId)
      : db.prepare('select id, start_time, end_time, user, status from usage_logs where chamber_id = ?').all(params.chamberId)
  ) as Array<Pick<UsageLogRow, 'id' | 'start_time' | 'end_time' | 'user' | 'status'>>

  const candStartMs = params.startMs
  const candEndMs =
    params.endMs !== null
      ? params.endMs
      : params.status === 'completed'
        ? candStartMs
        : Number.POSITIVE_INFINITY
  const candIsOccupyingNow =
    params.status !== 'completed' &&
    (params.status === 'in-progress' || params.status === 'overdue' || candStartMs <= params.nowMs)

  for (const r of rows) {
    const existStartMs = parseIsoMs(r.start_time)
    if (existStartMs === null) continue
    const existExplicitEndMs = r.end_time ? parseIsoMs(r.end_time) : null
    const existEndMs =
      existExplicitEndMs !== null
        ? existExplicitEndMs
        : r.status === 'completed'
          ? existStartMs
          : Number.POSITIVE_INFINITY

    if (candStartMs < existEndMs && existStartMs < candEndMs) {
      return {
        error: 'usage_log_overlap',
        conflict: {
          id: r.id,
          startTime: r.start_time,
          endTime: r.end_time ?? null,
          user: r.user,
          status: r.status,
        },
      }
    }

    const existIsOccupyingNow =
      r.status !== 'completed' &&
      (r.status === 'in-progress' || r.status === 'overdue' || existStartMs <= params.nowMs)
    if (candIsOccupyingNow && existIsOccupyingNow) {
      return {
        error: 'usage_log_active_conflict',
        conflict: {
          id: r.id,
          startTime: r.start_time,
          endTime: r.end_time ?? null,
          user: r.user,
          status: r.status,
        },
      }
    }
  }

  return null
}

const isTestProjectAllowedForChamber = (db: Database.Database, chamberId: string, testProjectId: string) => {
  const chamber = db.prepare('select category from assets where id = ?').get(chamberId) as { category?: string | null } | undefined
  const testProject = db.prepare('select asset_categories from test_projects where id = ?').get(testProjectId) as
    | { asset_categories?: string | null }
    | undefined
  if (!testProject) return { ok: false, error: 'test_project_not_found' as const }
  const allowedCategories = parseJsonOr<string[]>(testProject.asset_categories, []).filter((v) => typeof v === 'string')
  if (allowedCategories.length === 0) return { ok: true as const }
  const chamberCategory = typeof chamber?.category === 'string' ? chamber.category.trim() : ''
  if (!chamberCategory) return { ok: false, error: 'chamber_category_missing' as const }
  return { ok: allowedCategories.includes(chamberCategory), error: 'test_project_not_allowed' as const }
}

const auditSnapshotIfWritten = (db: Database.Database, req: Request, id: string, source: 'at_completion' | 'recompute') => {
  const snap = writeUsageLogCostSnapshot(db, id, source)
  if (!snap.updated) return
  writeAuditFromReq(db, req, {
    action: 'usage_log.snapshot_written',
    entityType: 'usage_log',
    entityId: id,
    before: snap.prev,
    after: { ...snap.next, snapshotAt: snap.snapshotAt, snapshotSource: snap.snapshotSource },
  })
}

const usageLogListQuerySchema = z.object({
  chamberId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  status: usageLogStatusSchema.optional(),
  from: z
    .string()
    .min(1)
    .refine((v) => parseIsoMs(v) !== null, { message: 'invalid_from' })
    .optional(),
  to: z
    .string()
    .min(1)
    .refine((v) => parseIsoMs(v) !== null, { message: 'invalid_to' })
    .optional(),
  ...paginationQueryShape,
})

usageLogsRouter.get('/', requireAuth, validateQuery(usageLogListQuerySchema), (req, res) => {
  const q = (req.validatedQuery ?? {}) as z.infer<typeof usageLogListQuerySchema>
  const db = getDb()
  const clauses: string[] = []
  const params: unknown[] = []

  if (q.chamberId) {
    clauses.push('chamber_id = ?')
    params.push(q.chamberId)
  }
  if (q.projectId) {
    clauses.push('project_id = ?')
    params.push(q.projectId)
  }
  if (q.status) {
    clauses.push('status = ?')
    params.push(q.status)
  }
  if (q.from) {
    const ms = parseIsoMs(q.from)
    if (ms !== null) {
      clauses.push('start_time >= ?')
      params.push(new Date(ms).toISOString())
    }
  }
  if (q.to) {
    const ms = parseIsoMs(q.to)
    if (ms !== null) {
      clauses.push('start_time <= ?')
      params.push(new Date(ms).toISOString())
    }
  }

  const whereSql = clauses.length ? `where ${clauses.join(' and ')}` : ''
  const countRow = db.prepare(`select count(*) as total from usage_logs ${whereSql}`).get(...params) as { total: number }

  let limitSql = ''
  const rowParams = [...params]
  if (q.limit !== undefined) {
    limitSql = ' limit ? offset ?'
    rowParams.push(q.limit, q.offset ?? 0)
  } else if (q.offset !== undefined) {
    limitSql = ' limit -1 offset ?'
    rowParams.push(q.offset)
  }

  const rows = db
    .prepare(`select * from usage_logs ${whereSql} order by created_at desc${limitSql}`)
    .all(...rowParams) as UsageLogRow[]
  res.json({ items: rows.map(mapUsageLogRow), total: countRow.total })
})

usageLogsRouter.get('/:id', requireAuth, (req, res) => {
  const db = getDb()
  const r = db.prepare('select * from usage_logs where id = ?').get(req.params.id) as UsageLogRow | undefined
  if (!r) return res.status(404).json({ error: 'not_found' })
  res.json({ item: mapUsageLogRow(r) })
})

usageLogsRouter.post('/', requireAuth, validateBody(usageLogCreateSchema), (req, res) => {
  const d = req.body as z.infer<typeof usageLogCreateSchema>
  const db = getDb()

  const chamberCheck = ensureChamberUsable(db, d.chamberId)
  if (!chamberCheck.ok) return res.status(400).json({ error: chamberCheck.error })

  const startMs = parseIsoMs(d.startTime)
  if (startMs === null) return res.status(400).json({ error: 'invalid_time_range' })
  const explicitEndMs = d.endTime !== undefined ? parseIsoMs(d.endTime) : null
  if (d.endTime !== undefined && explicitEndMs === null) return res.status(400).json({ error: 'invalid_time_range' })

  const id = randomToken(16)
  const createdAt = new Date().toISOString()
  const nowMs = Date.parse(createdAt)
  const normalizedStartTime =
    d.status === 'in-progress' && startMs - nowMs > CLOCK_SKEW_ALLOW_MS ? createdAt : d.startTime
  const normalizedStartMs = parseIsoMs(normalizedStartTime) ?? startMs
  const normalizedEndTime = d.endTime ?? (d.status === 'completed' ? createdAt : undefined)
  const normalizedEndMs = normalizedEndTime !== undefined ? parseIsoMs(normalizedEndTime) : null
  if (normalizedEndMs !== null && normalizedEndMs < normalizedStartMs) {
    return res.status(400).json({ error: 'invalid_time_range' })
  }

  if (d.testProjectId) {
    const allowed = isTestProjectAllowedForChamber(db, d.chamberId, d.testProjectId)
    if (!allowed.ok) return res.status(400).json({ error: allowed.error })
  }

  let statusChange: { updated: boolean; targetStatus: string | null; updatedAt: string | null } = {
    updated: false,
    targetStatus: null,
    updatedAt: null,
  }
  let scheduleConflict: UsageLogScheduleConflict | null = null
  db.transaction(() => {
    scheduleConflict = findChamberScheduleConflict(db, {
      chamberId: d.chamberId,
      startMs: normalizedStartMs,
      endMs: normalizedEndMs,
      status: d.status,
      nowMs,
    })
    if (scheduleConflict) return

    db.prepare(
      [
        'insert into usage_logs (',
        'id, chamber_id, project_id, test_project_id, start_time, end_time, user, status, notes, selected_config_ids, selected_waterfall, created_at',
        ') values (?,?,?,?,?,?,?,?,?,?,?,?)',
      ].join(' ')
    ).run(
      id,
      d.chamberId,
      d.projectId ?? null,
      d.testProjectId ?? null,
      normalizedStartTime,
      normalizedEndTime ?? null,
      d.user,
      d.status,
      d.notes ?? null,
      JSON.stringify(d.selectedConfigIds ?? []),
      d.selectedWaterfall ?? null,
      createdAt
    )
    statusChange = recomputeChamberStatus(db, d.chamberId)
  })()

  if (scheduleConflict) {
    return res.status(409).json(scheduleConflict)
  }

  if (statusChange.updated && statusChange.targetStatus && statusChange.updatedAt) {
    publishAssetStatusChanged(d.chamberId, statusChange.targetStatus, statusChange.updatedAt)
  }
  publishUsageLogChanged(id, d.chamberId, createdAt)

  writeAuditFromReq(db, req, {
    action: 'usage_log.create',
    entityType: 'usage_log',
    entityId: id,
    after: {
      id,
      chamberId: d.chamberId,
      projectId: d.projectId ?? null,
      testProjectId: d.testProjectId ?? null,
      startTime: normalizedStartTime,
      endTime: normalizedEndTime ?? null,
      user: d.user,
      status: d.status,
      notes: d.notes ?? null,
    },
  })

  if (d.status === 'completed' && normalizedEndTime) {
    auditSnapshotIfWritten(db, req, id, 'at_completion')
  }

  const created = db.prepare('select * from usage_logs where id = ?').get(id) as UsageLogRow | undefined
  res.json({ id, item: created ? mapUsageLogRow(created) : undefined })
})

usageLogsRouter.patch('/:id', requireAuth, validateBody(usageLogPatchSchema), (req, res) => {
  const id = req.params.id
  const d = req.body as z.infer<typeof usageLogPatchSchema>
  const db = getDb()
  const before = db.prepare('select * from usage_logs where id = ?').get(id) as UsageLogRow | undefined
  if (!before) return res.status(404).json({ error: 'not_found' })

  const isManagerOrAdmin = req.user?.role === 'admin' || req.user?.role === 'manager'
  if (before.status === 'completed' && !isManagerOrAdmin) {
    return res.status(403).json({ error: 'manager_required' })
  }

  const nextChamberId = d.chamberId ?? before.chamber_id
  const prevChamberId = before.chamber_id
  if (d.chamberId !== undefined && d.chamberId !== prevChamberId) {
    const chamberCheck = ensureChamberUsable(db, nextChamberId)
    if (!chamberCheck.ok) return res.status(400).json({ error: chamberCheck.error })
  }

  const nextTestProjectId =
    d.testProjectId !== undefined
      ? d.testProjectId === null
        ? undefined
        : d.testProjectId
      : before.test_project_id ?? undefined

  const nowIso = new Date().toISOString()
  const nowMs = Date.parse(nowIso)
  const rawStartMs = d.startTime ? parseIsoMs(d.startTime) : null
  if (d.startTime !== undefined && rawStartMs === null) {
    return res.status(400).json({ error: 'invalid_time_range' })
  }
  const shouldNormalizeInProgressStart =
    d.status === 'in-progress' && d.startTime && rawStartMs !== null && rawStartMs - nowMs > CLOCK_SKEW_ALLOW_MS

  const beforeStartMs = parseIsoMs(before.start_time)
  const beforeEndMs = before.end_time ? parseIsoMs(before.end_time) : null
  const normalizedStartTime =
    d.startTime !== undefined ? (shouldNormalizeInProgressStart ? nowIso : d.startTime) : undefined
  const autoCompletedEndTime = (() => {
    if (d.endTime !== undefined || d.status !== 'completed') return undefined
    if (!before.end_time) return nowIso
    if (
      before.status !== 'completed' &&
      beforeStartMs !== null &&
      beforeEndMs !== null &&
      beforeStartMs <= nowMs &&
      nowMs < beforeEndMs
    ) {
      return nowIso
    }
    return undefined
  })()

  const effectiveStartTime = normalizedStartTime ?? before.start_time
  const effectiveEndTime = d.endTime !== undefined ? d.endTime : autoCompletedEndTime ?? before.end_time
  const effectiveStatus = d.status ?? before.status

  const effStartMs = parseIsoMs(effectiveStartTime)
  const effEndMs = effectiveEndTime !== null && effectiveEndTime !== undefined ? parseIsoMs(effectiveEndTime) : null
  if (effectiveEndTime !== null && effectiveEndTime !== undefined && effEndMs === null) {
    return res.status(400).json({ error: 'invalid_time_range' })
  }
  if (effStartMs !== null && effEndMs !== null && effEndMs < effStartMs) {
    return res.status(400).json({ error: 'invalid_time_range' })
  }

  if (nextTestProjectId) {
    const allowed = isTestProjectAllowedForChamber(db, nextChamberId, nextTestProjectId)
    if (!allowed.ok) return res.status(400).json({ error: allowed.error })
  }

  const patchInput: Record<string, unknown> = {
    ...d,
    ...(normalizedStartTime !== undefined ? { startTime: normalizedStartTime } : null),
    ...(autoCompletedEndTime !== undefined ? { endTime: autoCompletedEndTime } : null),
  }

  const affectsSchedule =
    d.chamberId !== undefined || d.startTime !== undefined || d.endTime !== undefined || d.status !== undefined
  const isStoppingWithoutExpanding =
    d.status === 'completed' &&
    nextChamberId === prevChamberId &&
    d.startTime === undefined &&
    (d.endTime === undefined || (beforeEndMs !== null && effEndMs !== null && effEndMs <= beforeEndMs))

  const statusChanges: Array<{ chamberId: string; status: string; updatedAt: string }> = []
  let scheduleConflict: UsageLogScheduleConflict | null = null
  db.transaction(() => {
    if (affectsSchedule && !isStoppingWithoutExpanding && effStartMs !== null) {
      scheduleConflict = findChamberScheduleConflict(db, {
        chamberId: nextChamberId,
        startMs: effStartMs,
        endMs: effEndMs,
        status: effectiveStatus,
        nowMs,
        excludeId: id,
      })
      if (scheduleConflict) return
    }

    const { sets, params } = buildPatchSet(patchInput, USAGE_LOG_PATCH_SPECS)
    if (sets.length) {
      db.prepare(`update usage_logs set ${sets.join(', ')} where id = ?`).run(...params, id)
    }
    const nextRes = recomputeChamberStatus(db, nextChamberId)
    if (nextRes.updated && nextRes.targetStatus && nextRes.updatedAt) {
      statusChanges.push({ chamberId: nextChamberId, status: nextRes.targetStatus, updatedAt: nextRes.updatedAt })
    }
    if (prevChamberId !== nextChamberId) {
      const prevRes = recomputeChamberStatus(db, prevChamberId)
      if (prevRes.updated && prevRes.targetStatus && prevRes.updatedAt) {
        statusChanges.push({ chamberId: prevChamberId, status: prevRes.targetStatus, updatedAt: prevRes.updatedAt })
      }
    }
  })()

  if (scheduleConflict) {
    return res.status(409).json(scheduleConflict)
  }

  for (const sc of statusChanges) {
    publishAssetStatusChanged(sc.chamberId, sc.status, sc.updatedAt)
  }
  publishUsageLogChanged(id, nextChamberId, nowIso)

  let after = db.prepare('select * from usage_logs where id = ?').get(id) as UsageLogRow | undefined
  writeAuditFromReq(db, req, {
    action: 'usage_log.update',
    entityType: 'usage_log',
    entityId: id,
    before: auditSummary(before),
    after: after ? auditSummary(after) : null,
  })

  if (d.status !== undefined || d.endTime !== undefined || d.startTime !== undefined || d.chamberId !== undefined) {
    auditSnapshotIfWritten(db, req, id, 'recompute')
    after = db.prepare('select * from usage_logs where id = ?').get(id) as UsageLogRow | undefined
  }

  res.json({ ok: true, item: after ? mapUsageLogRow(after) : undefined })
})

usageLogsRouter.delete('/:id', requireAuth, requireManager, (req, res) => {
  const id = req.params.id
  const db = getDb()
  const before = db.prepare('select * from usage_logs where id = ?').get(id) as UsageLogRow | undefined
  if (!before) return res.json({ ok: true })

  const nowIso = new Date().toISOString()
  let statusChange: { updated: boolean; targetStatus: string | null; updatedAt: string | null } = {
    updated: false,
    targetStatus: null,
    updatedAt: null,
  }
  db.transaction(() => {
    db.prepare('delete from usage_logs where id = ?').run(id)
    statusChange = recomputeChamberStatus(db, before.chamber_id)
  })()
  if (statusChange.updated && statusChange.targetStatus && statusChange.updatedAt) {
    publishAssetStatusChanged(before.chamber_id, statusChange.targetStatus, statusChange.updatedAt)
  }
  publishUsageLogChanged(id, before.chamber_id, nowIso)

  writeAuditFromReq(db, req, {
    action: 'usage_log.delete',
    entityType: 'usage_log',
    entityId: id,
    before: auditSummary(before),
  })

  res.json({ ok: true })
})
