import { Router, type Request } from 'express'
import { z } from 'zod'
import type Database from 'better-sqlite3'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireManager } from '../middlewares/requireManager.js'
import { validateBody, validateQuery } from '../middlewares/validate.js'
import { attachmentSchema, paginationQueryShape, repairStatusSchema } from '../schemas.js'
import { getDb } from '../../db/db.js'
import { buildPatchSet, type PatchFieldSpec } from '../../db/sqlHelpers.js'
import { randomToken } from '../../util/crypto.js'
import { parseJson, parseJsonOr } from '../../util/json.js'
import { recomputeChamberStatus } from '../../services/assetStatus.js'
import { publishAssetStatusChanged, publishRepairTicketChanged } from '../../services/events.js'
import { writeAuditFromReq } from '../../services/auditLog.js'
import type { AttachmentDto, RepairStatus, RepairTicketRow, RepairTimelineEntry } from '../../types.js'

export const repairTicketsRouter = Router()

const createSchema = z.object({
  assetId: z.string().min(1),
  problemDesc: z.string().min(1),
  startedAt: z.string().optional(),
  expectedReturnAt: z.string().optional(),
})

const patchSchema = z.object({
  problemDesc: z.string().optional(),
  startedAt: z.string().optional().nullable(),
  vendorName: z.string().optional().nullable(),
  quoteAmount: z.number().optional().nullable(),
  expectedReturnAt: z.string().optional().nullable(),
  attachments: z.array(attachmentSchema).optional().nullable(),
})

const transitionSchema = z.object({
  to: repairStatusSchema,
  note: z.string().optional(),
  vendorName: z.string().optional(),
  quoteAmount: z.number().optional(),
})

const PATCH_SPECS: Record<string, PatchFieldSpec> = {
  problemDesc: { column: 'problem_desc' },
  startedAt: { column: 'started_at', nullable: true },
  vendorName: { column: 'vendor_name', nullable: true },
  quoteAmount: { column: 'quote_amount', nullable: true },
  expectedReturnAt: { column: 'expected_return_at', nullable: true },
  attachments: { column: 'attachments', json: true, nullable: true },
}

interface RepairTicketDto {
  id: string
  assetId: string
  status: RepairStatus
  problemDesc: string
  startedAt?: string
  vendorName?: string
  quoteAmount?: number
  quoteAt?: string
  expectedReturnAt?: string
  completedAt?: string
  createdAt: string
  updatedAt?: string
  timeline?: RepairTimelineEntry[]
  attachments?: AttachmentDto[]
}

const mapRow = (r: RepairTicketRow): RepairTicketDto => ({
  id: r.id,
  assetId: r.asset_id,
  status: r.status,
  problemDesc: r.problem_desc,
  startedAt: r.started_at ?? undefined,
  vendorName: r.vendor_name ?? undefined,
  quoteAmount: typeof r.quote_amount === 'number' ? r.quote_amount : undefined,
  quoteAt: r.quote_at ?? undefined,
  expectedReturnAt: r.expected_return_at ?? undefined,
  completedAt: r.completed_at ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at ?? undefined,
  timeline: parseJson<RepairTimelineEntry[]>(r.timeline),
  attachments: parseJson<AttachmentDto[]>(r.attachments),
})

const canViewSensitive = (req: Request) => req.user?.role === 'admin' || req.user?.role === 'manager'

const serializeTicket = (row: RepairTicketRow, includeSensitive: boolean) => {
  const mapped = mapRow(row)
  if (includeSensitive) return mapped
  delete mapped.vendorName
  delete mapped.quoteAmount
  delete mapped.quoteAt
  delete mapped.attachments
  return mapped
}

const auditTicketSnapshot = (r: RepairTicketRow) => ({
  status: r.status,
  problemDesc: r.problem_desc,
  startedAt: r.started_at ?? null,
  vendorName: r.vendor_name ?? null,
  quoteAmount: r.quote_amount ?? null,
  expectedReturnAt: r.expected_return_at ?? null,
  completedAt: r.completed_at ?? null,
})

const computeAnyOtherOpen = (db: Database.Database, assetId: string, excludeId?: string) => {
  const row = excludeId
    ? (db
        .prepare("select 1 as ok from repair_tickets where asset_id = ? and status <> 'completed' and id <> ? limit 1")
        .get(assetId, excludeId) as { ok: 1 } | undefined)
    : (db
        .prepare("select 1 as ok from repair_tickets where asset_id = ? and status <> 'completed' limit 1")
        .get(assetId) as { ok: 1 } | undefined)
  return row?.ok === 1
}

const repairTicketListQuerySchema = z.object({
  status: repairStatusSchema.optional(),
  assetId: z.string().min(1).optional(),
  ...paginationQueryShape,
})

repairTicketsRouter.get('/', requireAuth, validateQuery(repairTicketListQuerySchema), (req, res) => {
  const includeSensitive = canViewSensitive(req)
  const q = (req.validatedQuery ?? {}) as z.infer<typeof repairTicketListQuerySchema>
  const db = getDb()
  const clauses: string[] = []
  const params: unknown[] = []
  if (q.status) {
    clauses.push('status = ?')
    params.push(q.status)
  }
  if (q.assetId) {
    clauses.push('asset_id = ?')
    params.push(q.assetId)
  }
  const whereSql = clauses.length ? `where ${clauses.join(' and ')}` : ''
  const countRow = db
    .prepare(`select count(*) as total from repair_tickets ${whereSql}`)
    .get(...params) as { total: number }

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
    .prepare(`select * from repair_tickets ${whereSql} order by coalesce(updated_at, created_at) desc${limitSql}`)
    .all(...rowParams) as RepairTicketRow[]
  const items = rows.map((r) => serializeTicket(r, includeSensitive))
  res.json({ items, total: countRow.total })
})

repairTicketsRouter.get('/:id', requireAuth, (req, res) => {
  const db = getDb()
  const row = db.prepare('select * from repair_tickets where id = ?').get(req.params.id) as RepairTicketRow | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  res.json({ item: serializeTicket(row, canViewSensitive(req)) })
})

repairTicketsRouter.post('/', requireAuth, validateBody(createSchema), (req, res) => {
  const d = req.body as z.infer<typeof createSchema>
  const db = getDb()
  const asset = db.prepare('select id, status from assets where id = ?').get(d.assetId) as
    | { id: string; status: string }
    | undefined
  if (!asset) return res.status(400).json({ error: 'asset_not_found' })
  if (asset.status === 'in-use') return res.status(400).json({ error: 'asset_in_use' })

  if (computeAnyOtherOpen(db, d.assetId)) return res.status(400).json({ error: 'open_ticket_exists' })

  const id = randomToken(16)
  const now = new Date().toISOString()
  const startedAt = d.startedAt ?? now
  const timeline = [{ at: startedAt, to: 'quote-pending' as const }]

  db.transaction(() => {
    db.prepare(
      [
        'insert into repair_tickets (',
        'id, asset_id, status, problem_desc, started_at, vendor_name, quote_amount, quote_at, expected_return_at, completed_at, created_at, updated_at, timeline, attachments',
        ') values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ].join(' ')
    ).run(
      id,
      d.assetId,
      'quote-pending',
      d.problemDesc,
      startedAt,
      null,
      null,
      null,
      d.expectedReturnAt ?? null,
      null,
      now,
      now,
      JSON.stringify(timeline),
      null
    )
    db.prepare('update assets set status = ?, updated_at = ? where id = ?').run('maintenance', now, d.assetId)
  })()

  publishAssetStatusChanged(d.assetId, 'maintenance', now)
  publishRepairTicketChanged(id, d.assetId, now)

  writeAuditFromReq(db, req, {
    action: 'repair_ticket.create',
    entityType: 'repair_ticket',
    entityId: id,
    after: {
      id,
      assetId: d.assetId,
      status: 'quote-pending',
      problemDesc: d.problemDesc,
      startedAt,
      expectedReturnAt: d.expectedReturnAt ?? null,
    },
  })

  const created = db.prepare('select * from repair_tickets where id = ?').get(id) as RepairTicketRow | undefined
  res.json({ id, item: created ? serializeTicket(created, canViewSensitive(req)) : undefined })
})

repairTicketsRouter.patch('/:id', requireAuth, requireManager, validateBody(patchSchema), (req, res) => {
  const id = req.params.id
  const d = req.body as z.infer<typeof patchSchema>
  const db = getDb()
  const before = db.prepare('select * from repair_tickets where id = ?').get(id) as RepairTicketRow | undefined
  if (!before) return res.status(404).json({ error: 'not_found' })

  const updatedAt = new Date().toISOString()
  const { sets, params } = buildPatchSet(d as Record<string, unknown>, PATCH_SPECS, [
    { column: 'updated_at', value: updatedAt },
  ])
  db.prepare(`update repair_tickets set ${sets.join(', ')} where id = ?`).run(...params, id)

  const after = db.prepare('select * from repair_tickets where id = ?').get(id) as RepairTicketRow | undefined
  if (after?.asset_id) publishRepairTicketChanged(id, after.asset_id, updatedAt)

  writeAuditFromReq(db, req, {
    action: 'repair_ticket.update',
    entityType: 'repair_ticket',
    entityId: id,
    before: auditTicketSnapshot(before),
    after: after ? auditTicketSnapshot(after) : null,
  })

  res.json({ ok: true, item: after ? serializeTicket(after, canViewSensitive(req)) : undefined })
})

repairTicketsRouter.post('/:id/transition', requireAuth, requireManager, validateBody(transitionSchema), (req, res) => {
  const id = req.params.id
  const d = req.body as z.infer<typeof transitionSchema>
  const db = getDb()
  const current = db.prepare('select * from repair_tickets where id = ?').get(id) as RepairTicketRow | undefined
  if (!current) return res.status(404).json({ error: 'not_found' })
  if (current.status === 'completed' || current.status === d.to) {
    return res.status(400).json({ error: 'invalid_transition' })
  }

  const now = new Date().toISOString()
  const timeline = parseJsonOr<RepairTimelineEntry[]>(current.timeline, []).concat([
    {
      at: now,
      from: current.status,
      to: d.to,
      note: d.note,
    },
  ])

  let publishedAssetStatus: string | null = null
  db.transaction(() => {
    const updates: string[] = ['status = ?', 'updated_at = ?', 'timeline = ?']
    const params: unknown[] = [d.to, now, JSON.stringify(timeline)]

    if (d.to === 'repair-pending' && current.status === 'quote-pending') {
      updates.push('quote_at = ?')
      params.push(now)
      if (d.vendorName !== undefined) {
        updates.push('vendor_name = ?')
        params.push(d.vendorName)
      }
      if (d.quoteAmount !== undefined) {
        updates.push('quote_amount = ?')
        params.push(d.quoteAmount)
      }
    }

    if (d.to === 'completed') {
      updates.push('completed_at = ?')
      params.push(now)
    }

    db.prepare(`update repair_tickets set ${updates.join(', ')} where id = ?`).run(...params, id)

    const anyOtherOpen = d.to === 'completed' ? computeAnyOtherOpen(db, current.asset_id, id) : true
    const baseAssetStatus = d.to === 'completed' ? (anyOtherOpen ? 'maintenance' : 'available') : 'maintenance'
    db.prepare('update assets set status = ?, updated_at = ? where id = ?').run(baseAssetStatus, now, current.asset_id)
    if (baseAssetStatus === 'available') {
      const recomputed = recomputeChamberStatus(db, current.asset_id)
      publishedAssetStatus = recomputed.targetStatus ?? baseAssetStatus
    } else {
      publishedAssetStatus = baseAssetStatus
    }
  })()

  if (publishedAssetStatus) {
    publishAssetStatusChanged(current.asset_id, publishedAssetStatus, now)
  }
  publishRepairTicketChanged(id, current.asset_id, now)

  const after = db.prepare('select * from repair_tickets where id = ?').get(id) as RepairTicketRow | undefined
  writeAuditFromReq(db, req, {
    action: 'repair_ticket.transition',
    entityType: 'repair_ticket',
    entityId: id,
    before: { status: current.status },
    after: after ? { status: after.status } : { status: d.to },
  })

  res.json({ ok: true, item: after ? serializeTicket(after, canViewSensitive(req)) : undefined })
})

repairTicketsRouter.delete('/:id', requireAuth, requireManager, (req, res) => {
  const id = req.params.id
  const db = getDb()
  const before = db.prepare('select * from repair_tickets where id = ?').get(id) as RepairTicketRow | undefined
  if (!before) return res.json({ ok: true })

  const now = new Date().toISOString()
  let publishedAssetStatus: string | null = null
  db.transaction(() => {
    db.prepare('delete from repair_tickets where id = ?').run(id)
    const hasOtherOpen = computeAnyOtherOpen(db, before.asset_id)
    const baseStatus = hasOtherOpen ? 'maintenance' : 'available'
    db.prepare('update assets set status = ?, updated_at = ? where id = ?').run(baseStatus, now, before.asset_id)
    if (baseStatus === 'available') {
      const recomputed = recomputeChamberStatus(db, before.asset_id)
      publishedAssetStatus = recomputed.targetStatus ?? baseStatus
    } else {
      publishedAssetStatus = baseStatus
    }
  })()

  if (publishedAssetStatus) {
    publishAssetStatusChanged(before.asset_id, publishedAssetStatus, now)
  }
  publishRepairTicketChanged(id, before.asset_id, now)

  writeAuditFromReq(db, req, {
    action: 'repair_ticket.delete',
    entityType: 'repair_ticket',
    entityId: id,
    before: {
      assetId: before.asset_id,
      status: before.status,
      problemDesc: before.problem_desc,
    },
  })

  res.json({ ok: true })
})
