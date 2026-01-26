import { Router } from 'express'
import { z } from 'zod'
import { randomToken } from '../../util/crypto.js'
import { getDb } from '../../db/db.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireManager } from '../middlewares/requireManager.js'
import { recomputeChamberStatus } from '../../services/assetStatus.js'

export const usageLogsRouter = Router()

const CLOCK_SKEW_ALLOW_MS = 2 * 60 * 1000

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

  res.json({ id })
})

usageLogsRouter.patch('/:id', requireAuth, (req, res) => {
  const id = req.params.id
  const body = usageLogPatchSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const existing = db.prepare('select id, chamber_id from usage_logs where id = ?').get(id) as
    | { id: string; chamber_id: string }
    | undefined
  if (!existing) return res.status(404).json({ error: 'not_found' })

  const nextChamberId = d.chamberId ?? existing.chamber_id
  const prevChamberId = existing.chamber_id
  const nowIso = new Date().toISOString()
  const nowMs = Date.parse(nowIso)
  const startMs = d.startTime ? Date.parse(d.startTime) : Number.NaN
  const shouldNormalizeInProgressStart =
    d.status === 'in-progress' && d.startTime && Number.isFinite(startMs) && startMs - nowMs > CLOCK_SKEW_ALLOW_MS

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

  res.json({ ok: true })
})

usageLogsRouter.delete('/:id', requireAuth, requireManager, (req, res) => {
  const id = req.params.id
  const db = getDb()
  const existing = db.prepare('select id, chamber_id from usage_logs where id = ?').get(id) as
    | { id: string; chamber_id: string }
    | undefined
  if (!existing) return res.json({ ok: true })

  db.transaction(() => {
    db.prepare('delete from usage_logs where id = ?').run(id)
    recomputeChamberStatus(db, existing.chamber_id)
  })()

  res.json({ ok: true })
})
