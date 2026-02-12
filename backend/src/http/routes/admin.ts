import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireAdmin } from '../middlewares/requireAdmin.js'
import { getDb } from '../../db/db.js'
import { recomputeChamberStatus } from '../../services/assetStatus.js'
import { randomToken } from '../../util/crypto.js'
import { parseJson } from '../../util/json.js'
import { backfillUsageLogCostSnapshots } from '../../services/costSnapshotBackfill.js'

export const adminRouter = Router()

adminRouter.post('/reconcile/asset-status', requireAuth, requireAdmin, (_req, res) => {
  const db = getDb()
  const assets = db.prepare("select id from assets where type = 'chamber'").all() as { id: string }[]
  let updated = 0
  for (const a of assets) {
    const r = recomputeChamberStatus(db, a.id)
    if (r.updated) updated += 1
  }
  res.json({ ok: true, scanned: assets.length, updated })
})

const assetCategoryRateUpsertSchema = z.object({
  category: z.string(),
  hourlyRateCents: z.number().int().min(0),
})

adminRouter.get('/asset-category-rates', requireAuth, requireAdmin, (_req, res) => {
  const db = getDb()
  const rows = db
    .prepare(
      `
      with categories as (
        select distinct (case when category is null or trim(category) = '' then '' else category end) as category from assets
        union
        select category from asset_category_rates
      )
      select c.category as category, coalesce(r.hourly_rate_cents, 0) as hourly_rate_cents
      from categories c
      left join asset_category_rates r on r.category = c.category
      order by c.category asc
      `
    )
    .all() as Array<any>

  res.json({
    items: rows.map((r) => ({
      category: typeof r.category === 'string' ? r.category : '',
      hourlyRateCents: typeof r.hourly_rate_cents === 'number' ? r.hourly_rate_cents : 0,
    })),
  })
})

adminRouter.put('/asset-category-rates', requireAuth, requireAdmin, (req, res) => {
  const body = assetCategoryRateUpsertSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  db.prepare(
    `
    insert into asset_category_rates (category, hourly_rate_cents)
    values (?, ?)
    on conflict(category) do update set hourly_rate_cents = excluded.hourly_rate_cents
    `
  ).run(d.category, d.hourlyRateCents)
  res.json({ ok: true })
})

adminRouter.post('/backfill/cost-snapshots', requireAuth, requireAdmin, (req, res) => {
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
  const db = getDb()
  const r = backfillUsageLogCostSnapshots(db, { limit })
  res.json({ ok: true, scanned: r.scanned, updated: r.updated })
})

adminRouter.get('/audit-logs', requireAuth, requireAdmin, (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined
  const to = typeof req.query.to === 'string' ? req.query.to : undefined
  const actorUserId = typeof req.query.actorUserId === 'string' ? req.query.actorUserId : undefined
  const actorUsername = typeof req.query.actorUsername === 'string' ? req.query.actorUsername : undefined
  const action = typeof req.query.action === 'string' ? req.query.action : undefined
  const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined
  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : undefined
  const page = typeof req.query.page === 'string' ? Number(req.query.page) : 0
  const pageSize = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : 50

  const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(200, Math.floor(pageSize)) : 50

  const clauses: string[] = []
  const params: any[] = []

  if (from) {
    clauses.push('at >= ?')
    params.push(from)
  }
  if (to) {
    clauses.push('at <= ?')
    params.push(to)
  }
  if (actorUserId) {
    clauses.push('actor_user_id = ?')
    params.push(actorUserId)
  }
  if (actorUsername) {
    clauses.push('actor_username = ?')
    params.push(actorUsername)
  }
  if (action) {
    clauses.push('action = ?')
    params.push(action)
  }
  if (entityType) {
    clauses.push('entity_type = ?')
    params.push(entityType)
  }
  if (entityId) {
    clauses.push('entity_id = ?')
    params.push(entityId)
  }
  if (requestId) {
    clauses.push('request_id = ?')
    params.push(requestId)
  }

  const whereSql = clauses.length ? `where ${clauses.join(' and ')}` : ''
  const db = getDb()
  const totalRow = db.prepare(`select count(1) as c from audit_logs ${whereSql}`).get(...params) as { c: number } | undefined
  const total = typeof totalRow?.c === 'number' ? totalRow.c : 0

  const offset = safePage * safePageSize
  const rows = db
    .prepare(`select * from audit_logs ${whereSql} order by at desc limit ? offset ?`)
    .all(...params, safePageSize, offset) as any[]

  res.json({
    total,
    items: rows.map((r) => ({
      id: r.id,
      at: r.at,
      actorUserId: r.actor_user_id,
      actorUsername: r.actor_username,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      ip: r.ip ?? undefined,
      userAgent: r.user_agent ?? undefined,
      requestId: r.request_id ?? undefined,
      before: parseJson<any>(r.before_json, undefined as any),
      after: parseJson<any>(r.after_json, undefined as any),
    })),
  })
})

const csvEscape = (v: any) => {
  const s = v === null || typeof v === 'undefined' ? '' : String(v)
  const needs = /[",\n\r]/.test(s)
  const out = s.replace(/"/g, '""')
  return needs ? `"${out}"` : out
}

adminRouter.get('/audit-logs/export', requireAuth, requireAdmin, (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined
  const to = typeof req.query.to === 'string' ? req.query.to : undefined
  const actorUserId = typeof req.query.actorUserId === 'string' ? req.query.actorUserId : undefined
  const actorUsername = typeof req.query.actorUsername === 'string' ? req.query.actorUsername : undefined
  const action = typeof req.query.action === 'string' ? req.query.action : undefined
  const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined
  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : undefined
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 2000
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(5000, Math.floor(limit)) : 2000

  const clauses: string[] = []
  const params: any[] = []

  if (from) {
    clauses.push('at >= ?')
    params.push(from)
  }
  if (to) {
    clauses.push('at <= ?')
    params.push(to)
  }
  if (actorUserId) {
    clauses.push('actor_user_id = ?')
    params.push(actorUserId)
  }
  if (actorUsername) {
    clauses.push('actor_username = ?')
    params.push(actorUsername)
  }
  if (action) {
    clauses.push('action = ?')
    params.push(action)
  }
  if (entityType) {
    clauses.push('entity_type = ?')
    params.push(entityType)
  }
  if (entityId) {
    clauses.push('entity_id = ?')
    params.push(entityId)
  }
  if (requestId) {
    clauses.push('request_id = ?')
    params.push(requestId)
  }

  const whereSql = clauses.length ? `where ${clauses.join(' and ')}` : ''
  const db = getDb()
  const rows = db
    .prepare(`select * from audit_logs ${whereSql} order by at desc limit ?`)
    .all(...params, safeLimit) as any[]

  const header = [
    'id',
    'at',
    'actor_user_id',
    'actor_username',
    'action',
    'entity_type',
    'entity_id',
    'ip',
    'user_agent',
    'request_id',
    'before_json',
    'after_json',
  ]
  const lines = [header.join(',')]
  rows.forEach((r) => {
    lines.push(
      [
        csvEscape(r.id),
        csvEscape(r.at),
        csvEscape(r.actor_user_id),
        csvEscape(r.actor_username),
        csvEscape(r.action),
        csvEscape(r.entity_type),
        csvEscape(r.entity_id),
        csvEscape(r.ip),
        csvEscape(r.user_agent),
        csvEscape(r.request_id),
        csvEscape(r.before_json),
        csvEscape(r.after_json),
      ].join(',')
    )
  })

  res.setHeader('content-type', 'text/csv; charset=utf-8')
  res.setHeader('content-disposition', 'attachment; filename="audit-logs.csv"')
  res.send(lines.join('\n'))
})

adminRouter.get('/users', requireAuth, requireAdmin, (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const db = getDb()
  const where = status ? 'where status = ?' : ''
  const rows = db
    .prepare(`select id, username, role, status, approved_by, approved_at, created_at, updated_at from users ${where} order by created_at desc`)
    .all(...(status ? [status] : [])) as any[]
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      username: r.username,
      role: r.role,
      status: r.status,
      approvedBy: r.approved_by ?? undefined,
      approvedAt: r.approved_at ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? undefined
    }))
  })
})

const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(['manager', 'user'])
})

adminRouter.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const body = createUserSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const exists = db.prepare('select 1 as ok from users where username = ?').get(d.username) as { ok: 1 } | undefined
  if (exists?.ok === 1) return res.status(400).json({ error: 'username_taken' })
  const hash = await bcrypt.hash(d.password, 12)
  const now = new Date().toISOString()
  const id = randomToken(16)
  db.prepare(
    'insert into users (id, username, password_hash, role, status, approved_by, approved_at, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, d.username, hash, d.role, 'active', req.user!.id, now, now, now)
  res.json({ id })
})

const approveSchema = z.object({
  role: z.enum(['manager', 'user'])
})

adminRouter.post('/users/:id/approve', requireAuth, requireAdmin, (req, res) => {
  const body = approveSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const id = req.params.id
  const db = getDb()
  const now = new Date().toISOString()
  const row = db.prepare('select id from users where id = ?').get(id) as { id: string } | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  db.prepare('update users set status = ?, role = ?, approved_by = ?, approved_at = ?, updated_at = ? where id = ?').run(
    'active',
    body.data.role,
    req.user!.id,
    now,
    now,
    id
  )
  res.json({ ok: true })
})

adminRouter.post('/users/:id/disable', requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id
  const db = getDb()
  const row = db.prepare('select id, role from users where id = ?').get(id) as { id: string; role: string } | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.role === 'admin') return res.status(400).json({ error: 'cannot_disable_admin' })
  db.prepare('update users set status = ?, updated_at = ? where id = ?').run('disabled', new Date().toISOString(), id)
  res.json({ ok: true })
})

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8)
})

const setUserRoleSchema = z.object({
  role: z.enum(['manager', 'user'])
})

adminRouter.patch('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const body = setUserRoleSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const id = req.params.id
  const db = getDb()
  const row = db.prepare('select id, role from users where id = ?').get(id) as { id: string; role: string } | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.role === 'admin') return res.status(400).json({ error: 'cannot_change_admin_role' })
  db.prepare('update users set role = ?, updated_at = ? where id = ?').run(body.data.role, new Date().toISOString(), id)
  res.json({ ok: true })
})

adminRouter.post('/users/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  const body = resetPasswordSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const id = req.params.id
  const db = getDb()
  const row = db.prepare('select id, role from users where id = ?').get(id) as { id: string; role: string } | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.role === 'admin') return res.status(400).json({ error: 'cannot_reset_admin_password' })
  const hash = await bcrypt.hash(body.data.newPassword, 12)
  db.prepare('update users set password_hash = ?, updated_at = ? where id = ?').run(hash, new Date().toISOString(), id)
  res.json({ ok: true })
})
