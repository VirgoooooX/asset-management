import { Router } from 'express'
import { z } from 'zod'
import { randomToken } from '../../util/crypto.js'
import { getDb } from '../../db/db.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireManager } from '../middlewares/requireManager.js'
import { recomputeChamberStatus } from '../../services/assetStatus.js'
import { publishUsageLogChanged } from '../../services/events.js'
import { writeAuditLog } from '../../services/auditLog.js'
import { computeCostSnapshot } from '../../services/costSnapshot.js'

export const usageLogsRouter = Router()

const CLOCK_SKEW_ALLOW_MS = 2 * 60 * 1000

const parseStringArray = (value: any): string[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v) => typeof v === 'string')
  } catch {
    return []
  }
}

const isTestProjectAllowedForChamber = (db: any, chamberId: string, testProjectId: string) => {
  const chamber = db.prepare('select category from assets where id = ?').get(chamberId) as { category?: string } | undefined
  const testProject = db.prepare('select asset_categories from test_projects where id = ?').get(testProjectId) as
    | { asset_categories?: string | null }
    | undefined
  if (!testProject) return { ok: false, error: 'test_project_not_found' as const }
  const allowedCategories = parseStringArray(testProject.asset_categories)
  if (allowedCategories.length === 0) return { ok: true as const }
  const chamberCategory = typeof chamber?.category === 'string' ? chamber.category.trim() : ''
  if (!chamberCategory) return { ok: false, error: 'chamber_category_missing' as const }
  return { ok: allowedCategories.includes(chamberCategory), error: 'test_project_not_allowed' as const }
}

const ensureUsageLogCostSnapshot = (db: any, logId: string, source: 'at_completion' | 'recompute') => {
  const row = db
    .prepare(
      'select id, chamber_id, start_time, end_time, status, hourly_rate_cents_snapshot, billable_hours_snapshot, cost_cents_snapshot from usage_logs where id = ?'
    )
    .get(logId) as any | undefined
  if (!row) return { updated: false as const }
  if (row.status !== 'completed') return { updated: false as const }
  if (!row.end_time) return { updated: false as const }

  const assetRateRow = db
    .prepare(
      `
      select
        coalesce(r.hourly_rate_cents, a.hourly_rate_cents, 0) as rate_cents
      from assets a
      left join asset_category_rates r on r.category = (case when a.category is null or trim(a.category) = '' then '' else a.category end)
      where a.id = ?
      `
    )
    .get(row.chamber_id) as { rate_cents?: number } | undefined
  const hourlyRateCents = typeof assetRateRow?.rate_cents === 'number' ? assetRateRow.rate_cents : 0
  const snapshot = computeCostSnapshot({ startIso: row.start_time, endIso: row.end_time, hourlyRateCents })
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

  const changed =
    prev.hourlyRateCentsSnapshot !== next.hourlyRateCentsSnapshot ||
    prev.billableHoursSnapshot !== next.billableHoursSnapshot ||
    prev.costCentsSnapshot !== next.costCentsSnapshot

  if (!changed) return { updated: false as const }

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

const usageLogCreateSchema = z.object({
  chamberId: z.string().min(1),
  projectId: z.string().optional(),
  testProjectId: z.string().optional(),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  user: z.string().min(1),
  status: z.enum(['not-started', 'in-progress', 'completed', 'overdue']),
  notes: z.string().optional(),
  selectedConfigIds: z.array(z.string()).optional(),
  selectedWaterfall: z.string().optional()
})

const usageLogPatchSchema = z.object({
  chamberId: z.string().min(1).optional(),
  projectId: z.string().optional().nullable(),
  testProjectId: z.string().optional().nullable(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().optional().nullable(),
  user: z.string().min(1).optional(),
  status: z.enum(['not-started', 'in-progress', 'completed', 'overdue']).optional(),
  notes: z.string().optional().nullable(),
  selectedConfigIds: z.array(z.string()).optional().nullable(),
  selectedWaterfall: z.string().optional().nullable()
})

usageLogsRouter.get('/', requireAuth, (req, res) => {
  const chamberId = typeof req.query.chamberId === 'string' ? req.query.chamberId : undefined
  const db = getDb()
  const rows = chamberId
    ? (db
        .prepare('select * from usage_logs where chamber_id = ? order by created_at desc')
        .all(chamberId) as any[])
    : (db.prepare('select * from usage_logs order by created_at desc').all() as any[])

  const result = rows.map((r) => ({
    id: r.id,
    chamberId: r.chamber_id,
    projectId: r.project_id ?? undefined,
    testProjectId: r.test_project_id ?? undefined,
    startTime: r.start_time,
    endTime: r.end_time ?? undefined,
    user: r.user,
    status: r.status,
    notes: r.notes ?? undefined,
    selectedConfigIds: r.selected_config_ids ? (JSON.parse(r.selected_config_ids) as string[]) : [],
    selectedWaterfall: r.selected_waterfall ?? undefined,
    hourlyRateCentsSnapshot: typeof r.hourly_rate_cents_snapshot === 'number' ? r.hourly_rate_cents_snapshot : undefined,
    billableHoursSnapshot: typeof r.billable_hours_snapshot === 'number' ? r.billable_hours_snapshot : undefined,
    costCentsSnapshot: typeof r.cost_cents_snapshot === 'number' ? r.cost_cents_snapshot : undefined,
    snapshotAt: r.snapshot_at ?? undefined,
    snapshotSource: r.snapshot_source ?? undefined,
    createdAt: r.created_at
  }))
  res.json({ items: result })
})

usageLogsRouter.get('/:id', requireAuth, (req, res) => {
  const id = req.params.id
  const db = getDb()
  const r = db.prepare('select * from usage_logs where id = ?').get(id) as any | undefined
  if (!r) return res.status(404).json({ error: 'not_found' })
  res.json({
    item: {
      id: r.id,
      chamberId: r.chamber_id,
      projectId: r.project_id ?? undefined,
      testProjectId: r.test_project_id ?? undefined,
      startTime: r.start_time,
      endTime: r.end_time ?? undefined,
      user: r.user,
      status: r.status,
      notes: r.notes ?? undefined,
      selectedConfigIds: r.selected_config_ids ? (JSON.parse(r.selected_config_ids) as string[]) : [],
      selectedWaterfall: r.selected_waterfall ?? undefined,
      hourlyRateCentsSnapshot: typeof r.hourly_rate_cents_snapshot === 'number' ? r.hourly_rate_cents_snapshot : undefined,
      billableHoursSnapshot: typeof r.billable_hours_snapshot === 'number' ? r.billable_hours_snapshot : undefined,
      costCentsSnapshot: typeof r.cost_cents_snapshot === 'number' ? r.cost_cents_snapshot : undefined,
      snapshotAt: r.snapshot_at ?? undefined,
      snapshotSource: r.snapshot_source ?? undefined,
      createdAt: r.created_at
    }
  })
})

usageLogsRouter.post('/', requireAuth, (req, res) => {
  const body = usageLogCreateSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const id = randomToken(16)
  const createdAt = new Date().toISOString()
  const nowIso = new Date().toISOString()
  const nowMs = Date.parse(nowIso)
  const startMs = Date.parse(d.startTime)
  const normalizedStartTime =
    d.status === 'in-progress' && Number.isFinite(startMs) && startMs - nowMs > CLOCK_SKEW_ALLOW_MS ? nowIso : d.startTime
  const normalizedEndTime =
    d.status === 'in-progress' && d.endTime && Number.isFinite(startMs) && startMs - nowMs > CLOCK_SKEW_ALLOW_MS ? undefined : d.endTime

  if (d.testProjectId) {
    const allowed = isTestProjectAllowedForChamber(db, d.chamberId, d.testProjectId)
    if (!allowed.ok) return res.status(400).json({ error: allowed.error })
  }

  db.transaction(() => {
    db.prepare(
      [
        'insert into usage_logs (',
        'id, chamber_id, project_id, test_project_id, start_time, end_time, user, status, notes, selected_config_ids, selected_waterfall, created_at',
        ') values (?,?,?,?,?,?,?,?,?,?,?,?)'
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
    recomputeChamberStatus(db, d.chamberId)
  })()
  publishUsageLogChanged(id, d.chamberId, createdAt)

  writeAuditLog(db, {
    actor: req.user!,
    action: 'usage_log.create',
    entityType: 'usage_log',
    entityId: id,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    requestId: req.requestId,
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
    const snap = ensureUsageLogCostSnapshot(db, id, 'at_completion')
    if (snap.updated) {
      writeAuditLog(db, {
        actor: req.user!,
        action: 'usage_log.snapshot_written',
        entityType: 'usage_log',
        entityId: id,
        ip: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
        requestId: req.requestId,
        before: snap.prev,
        after: { ...snap.next, snapshotAt: snap.snapshotAt, snapshotSource: snap.snapshotSource },
      })
    }
  }

  res.json({ id })
})

usageLogsRouter.patch('/:id', requireAuth, (req, res) => {
  const id = req.params.id
  const body = usageLogPatchSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const existing = db.prepare('select id, chamber_id, test_project_id from usage_logs where id = ?').get(id) as
    | { id: string; chamber_id: string; test_project_id?: string | null }
    | undefined
  if (!existing) return res.status(404).json({ error: 'not_found' })

  const before = db.prepare('select * from usage_logs where id = ?').get(id) as any | undefined

  const nextChamberId = d.chamberId ?? existing.chamber_id
  const prevChamberId = existing.chamber_id
  const nextTestProjectId =
    d.testProjectId !== undefined ? (d.testProjectId === null ? undefined : d.testProjectId) : existing.test_project_id ?? undefined
  const nowIso = new Date().toISOString()
  const nowMs = Date.parse(nowIso)
  const startMs = d.startTime ? Date.parse(d.startTime) : Number.NaN
  const shouldNormalizeInProgressStart =
    d.status === 'in-progress' && d.startTime && Number.isFinite(startMs) && startMs - nowMs > CLOCK_SKEW_ALLOW_MS

  if (nextTestProjectId) {
    const allowed = isTestProjectAllowedForChamber(db, nextChamberId, nextTestProjectId)
    if (!allowed.ok) return res.status(400).json({ error: allowed.error })
  }

  db.transaction(() => {
    const updates: string[] = []
    const params: any[] = []
    const add = (sql: string, val: any) => {
      updates.push(sql)
      params.push(val)
    }

    if (d.chamberId !== undefined) add('chamber_id = ?', d.chamberId)
    if (d.projectId !== undefined) add('project_id = ?', d.projectId)
    if (d.testProjectId !== undefined) add('test_project_id = ?', d.testProjectId)
    if (d.startTime !== undefined) add('start_time = ?', shouldNormalizeInProgressStart ? nowIso : d.startTime)
    if (d.endTime !== undefined) add('end_time = ?', d.endTime)
    if (d.user !== undefined) add('user = ?', d.user)
    if (d.status !== undefined) add('status = ?', d.status)
    if (d.notes !== undefined) add('notes = ?', d.notes)
    if (d.selectedConfigIds !== undefined) add('selected_config_ids = ?', JSON.stringify(d.selectedConfigIds ?? []))
    if (d.selectedWaterfall !== undefined) add('selected_waterfall = ?', d.selectedWaterfall)

    if (updates.length) {
      db.prepare(`update usage_logs set ${updates.join(', ')} where id = ?`).run(...params, id)
    }
    recomputeChamberStatus(db, nextChamberId)
    if (prevChamberId !== nextChamberId) recomputeChamberStatus(db, prevChamberId)
  })()
  publishUsageLogChanged(id, nextChamberId, nowIso)

  const after = db.prepare('select * from usage_logs where id = ?').get(id) as any | undefined
  writeAuditLog(db, {
    actor: req.user!,
    action: 'usage_log.update',
    entityType: 'usage_log',
    entityId: id,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    requestId: req.requestId,
    before: before
      ? {
          chamberId: before.chamber_id,
          projectId: before.project_id ?? null,
          testProjectId: before.test_project_id ?? null,
          startTime: before.start_time,
          endTime: before.end_time ?? null,
          user: before.user,
          status: before.status,
          notes: before.notes ?? null,
        }
      : null,
    after: after
      ? {
          chamberId: after.chamber_id,
          projectId: after.project_id ?? null,
          testProjectId: after.test_project_id ?? null,
          startTime: after.start_time,
          endTime: after.end_time ?? null,
          user: after.user,
          status: after.status,
          notes: after.notes ?? null,
        }
      : null,
  })

  const shouldConsiderSnapshot =
    d.status !== undefined || d.endTime !== undefined || d.startTime !== undefined || d.chamberId !== undefined
  if (shouldConsiderSnapshot) {
    const snap = ensureUsageLogCostSnapshot(db, id, 'recompute')
    if (snap.updated) {
      writeAuditLog(db, {
        actor: req.user!,
        action: 'usage_log.snapshot_written',
        entityType: 'usage_log',
        entityId: id,
        ip: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
        requestId: req.requestId,
        before: snap.prev,
        after: { ...snap.next, snapshotAt: snap.snapshotAt, snapshotSource: snap.snapshotSource },
      })
    }
  }

  res.json({ ok: true })
})

usageLogsRouter.delete('/:id', requireAuth, requireManager, (req, res) => {
  const id = req.params.id
  const db = getDb()
  const existing = db.prepare('select id, chamber_id from usage_logs where id = ?').get(id) as
    | { id: string; chamber_id: string }
    | undefined
  if (!existing) return res.json({ ok: true })

  const before = db.prepare('select * from usage_logs where id = ?').get(id) as any | undefined

  const nowIso = new Date().toISOString()
  db.transaction(() => {
    db.prepare('delete from usage_logs where id = ?').run(id)
    recomputeChamberStatus(db, existing.chamber_id)
  })()
  publishUsageLogChanged(id, existing.chamber_id, nowIso)

  writeAuditLog(db, {
    actor: req.user!,
    action: 'usage_log.delete',
    entityType: 'usage_log',
    entityId: id,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    requestId: req.requestId,
    before: before
      ? {
          chamberId: before.chamber_id,
          projectId: before.project_id ?? null,
          testProjectId: before.test_project_id ?? null,
          startTime: before.start_time,
          endTime: before.end_time ?? null,
          user: before.user,
          status: before.status,
          notes: before.notes ?? null,
        }
      : null,
  })

  res.json({ ok: true })
})
