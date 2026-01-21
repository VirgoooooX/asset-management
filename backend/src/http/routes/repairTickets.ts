import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireAdmin } from '../middlewares/requireAdmin.js'
import { getDb } from '../../db/db.js'
import { randomToken } from '../../util/crypto.js'
import { parseJson } from '../../util/json.js'

export const repairTicketsRouter = Router()

const statusSchema = z.enum(['quote-pending', 'repair-pending', 'completed'])

const createSchema = z.object({
  assetId: z.string().min(1),
  problemDesc: z.string().min(1),
  expectedReturnAt: z.string().optional()
})

const patchSchema = z.object({
  problemDesc: z.string().optional(),
  vendorName: z.string().optional().nullable(),
  quoteAmount: z.number().optional().nullable(),
  expectedReturnAt: z.string().optional().nullable()
})

const transitionSchema = z.object({
  to: statusSchema,
  note: z.string().optional(),
  vendorName: z.string().optional(),
  quoteAmount: z.number().optional()
})

const mapRow = (r: any) => ({
  id: r.id,
  assetId: r.asset_id,
  status: r.status,
  problemDesc: r.problem_desc,
  vendorName: r.vendor_name ?? undefined,
  quoteAmount: typeof r.quote_amount === 'number' ? r.quote_amount : undefined,
  quoteAt: r.quote_at ?? undefined,
  expectedReturnAt: r.expected_return_at ?? undefined,
  completedAt: r.completed_at ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at ?? undefined,
  timeline: parseJson<any[]>(r.timeline, undefined as any)
})

const computeAnyOtherOpen = (db: any, assetId: string, excludeId?: string) => {
  const rows = db.prepare('select id, status from repair_tickets where asset_id = ?').all(assetId) as {
    id: string
    status: string
  }[]
  return rows.some((r) => r.id !== excludeId && r.status !== 'completed')
}

repairTicketsRouter.get('/', requireAuth, (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const assetId = typeof req.query.assetId === 'string' ? req.query.assetId : undefined
  const db = getDb()
  const clauses: string[] = []
  const params: any[] = []
  if (status) {
    clauses.push('status = ?')
    params.push(status)
  }
  if (assetId) {
    clauses.push('asset_id = ?')
    params.push(assetId)
  }
  const whereSql = clauses.length ? `where ${clauses.join(' and ')}` : ''
  const rows = db.prepare(`select * from repair_tickets ${whereSql}`).all(...params) as any[]
  const items = rows
    .map(mapRow)
    .sort((a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt))
  res.json({ items })
})

repairTicketsRouter.get('/:id', requireAuth, (req, res) => {
  const db = getDb()
  const row = db.prepare('select * from repair_tickets where id = ?').get(req.params.id) as any | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  res.json({ item: mapRow(row) })
})

repairTicketsRouter.post('/', requireAuth, requireAdmin, (req, res) => {
  const body = createSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const asset = db.prepare('select id, status from assets where id = ?').get(d.assetId) as
    | { id: string; status: string }
    | undefined
  if (!asset) return res.status(400).json({ error: 'asset_not_found' })
  if (asset.status === 'in-use') return res.status(400).json({ error: 'asset_in_use' })

  const hasOpen = computeAnyOtherOpen(db, d.assetId)
  if (hasOpen) return res.status(400).json({ error: 'open_ticket_exists' })

  const id = randomToken(16)
  const now = new Date().toISOString()
  const timeline = [{ at: now, to: 'quote-pending' as const }]

  db.transaction(() => {
    db.prepare(
      [
        'insert into repair_tickets (',
        'id, asset_id, status, problem_desc, vendor_name, quote_amount, quote_at, expected_return_at, completed_at, created_at, updated_at, timeline',
        ') values (?,?,?,?,?,?,?,?,?,?,?,?)'
      ].join(' ')
    ).run(
      id,
      d.assetId,
      'quote-pending',
      d.problemDesc,
      null,
      null,
      null,
      d.expectedReturnAt ?? null,
      null,
      now,
      now,
      JSON.stringify(timeline)
    )
    db.prepare('update assets set status = ?, updated_at = ? where id = ?').run('maintenance', now, d.assetId)
  })()

  res.json({ id })
})

repairTicketsRouter.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id
  const body = patchSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const row = db.prepare('select id from repair_tickets where id = ?').get(id) as { id: string } | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })

  const updates: string[] = []
  const params: any[] = []
  const add = (sql: string, val: any) => {
    updates.push(sql)
    params.push(val)
  }

  if (d.problemDesc !== undefined) add('problem_desc = ?', d.problemDesc)
  if (d.vendorName !== undefined) add('vendor_name = ?', d.vendorName ?? null)
  if (d.quoteAmount !== undefined) add('quote_amount = ?', d.quoteAmount ?? null)
  if (d.expectedReturnAt !== undefined) add('expected_return_at = ?', d.expectedReturnAt ?? null)
  add('updated_at = ?', new Date().toISOString())

  db.prepare(`update repair_tickets set ${updates.join(', ')} where id = ?`).run(...params, id)
  res.json({ ok: true })
})

repairTicketsRouter.post('/:id/transition', requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id
  const body = transitionSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const current = db.prepare('select * from repair_tickets where id = ?').get(id) as any | undefined
  if (!current) return res.status(404).json({ error: 'not_found' })

  const now = new Date().toISOString()
  const timeline = parseJson<any[]>(current.timeline, []).concat([
    {
      at: now,
      from: current.status,
      to: d.to,
      note: d.note
    }
  ])

  db.transaction(() => {
    const updates: string[] = ['status = ?', 'updated_at = ?', 'timeline = ?']
    const params: any[] = [d.to, now, JSON.stringify(timeline)]

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
    const nextAssetStatus = d.to === 'completed' ? (anyOtherOpen ? 'maintenance' : 'available') : 'maintenance'
    db.prepare('update assets set status = ?, updated_at = ? where id = ?').run(nextAssetStatus, now, current.asset_id)
  })()

  res.json({ ok: true })
})

repairTicketsRouter.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id
  const db = getDb()
  const ticket = db.prepare('select id, asset_id from repair_tickets where id = ?').get(id) as
    | { id: string; asset_id: string }
    | undefined
  if (!ticket) return res.json({ ok: true })

  db.transaction(() => {
    db.prepare('delete from repair_tickets where id = ?').run(id)
    const hasOtherOpen = computeAnyOtherOpen(db, ticket.asset_id)
    const status = hasOtherOpen ? 'maintenance' : 'available'
    db.prepare('update assets set status = ?, updated_at = ? where id = ?').run(
      status,
      new Date().toISOString(),
      ticket.asset_id
    )
  })()

  res.json({ ok: true })
})

