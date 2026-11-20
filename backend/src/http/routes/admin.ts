import { Router, type Request } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireAdmin } from '../middlewares/requireAdmin.js'
import { asyncHandler } from '../middlewares/asyncHandler.js'
import { validateBody } from '../middlewares/validate.js'
import { assignRoleSchema } from '../schemas.js'
import { getDb } from '../../db/db.js'
import { recomputeChamberStatus } from '../../services/assetStatus.js'
import { publishAssetStatusChanged } from '../../services/events.js'
import { writeAuditFromReq } from '../../services/auditLog.js'
import { randomToken } from '../../util/crypto.js'
import { parseJson } from '../../util/json.js'
import { hashPassword } from '../../util/password.js'
import { backfillUsageLogCostSnapshots } from '../../services/costSnapshotBackfill.js'
import type { AuditLogRow, CategoryRateRow, UserRow } from '../../types.js'

export const adminRouter = Router()

const buildAuditLogWhere = (query: Request['query']) => {
  const from = typeof query.from === 'string' ? query.from : undefined
  const to = typeof query.to === 'string' ? query.to : undefined
  const actorUserId = typeof query.actorUserId === 'string' ? query.actorUserId : undefined
  const actorUsername = typeof query.actorUsername === 'string' ? query.actorUsername : undefined
  const action = typeof query.action === 'string' ? query.action : undefined
  const entityType = typeof query.entityType === 'string' ? query.entityType : undefined
  const entityId = typeof query.entityId === 'string' ? query.entityId : undefined
  const requestId = typeof query.requestId === 'string' ? query.requestId : undefined

  const clauses: string[] = []
  const params: unknown[] = []

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

  return {
    whereSql: clauses.length ? `where ${clauses.join(' and ')}` : '',
    params,
  }
}

adminRouter.post('/reconcile/asset-status', requireAuth, requireAdmin, (_req, res) => {
  const db = getDb()
  const assets = db.prepare("select id from assets where type = 'chamber'").all() as { id: string }[]
  const changed: Array<{ assetId: string; status: string; updatedAt: string }> = []
  db.transaction(() => {
    for (const a of assets) {
      const r = recomputeChamberStatus(db, a.id)
      if (r.updated && r.targetStatus && r.updatedAt) {
        changed.push({ assetId: a.id, status: r.targetStatus, updatedAt: r.updatedAt })
      }
    }
  })()
  for (const c of changed) {
    publishAssetStatusChanged(c.assetId, c.status, c.updatedAt)
  }
  res.json({ ok: true, scanned: assets.length, updated: changed.length })
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
    .all() as CategoryRateRow[]

  res.json({
    items: rows.map((r) => ({
      category: typeof r.category === 'string' ? r.category : '',
      hourlyRateCents: typeof r.hourly_rate_cents === 'number' ? r.hourly_rate_cents : 0,
    })),
  })
})

adminRouter.put(
  '/asset-category-rates',
  requireAuth,
  requireAdmin,
  validateBody(assetCategoryRateUpsertSchema),
  (req, res) => {
    const d = req.body as z.infer<typeof assetCategoryRateUpsertSchema>
    const db = getDb()
    const prev = db
      .prepare('select hourly_rate_cents from asset_category_rates where category = ?')
      .get(d.category) as { hourly_rate_cents?: number } | undefined

    db.prepare(
      `
      insert into asset_category_rates (category, hourly_rate_cents)
      values (?, ?)
      on conflict(category) do update set hourly_rate_cents = excluded.hourly_rate_cents
      `
    ).run(d.category, d.hourlyRateCents)

    writeAuditFromReq(db, req, {
      action: 'asset_category_rate.upsert',
      entityType: 'asset_category_rate',
      entityId: d.category || '__default__',
      before: prev ? { category: d.category, hourlyRateCents: prev.hourly_rate_cents ?? 0 } : null,
      after: { category: d.category, hourlyRateCents: d.hourlyRateCents },
    })

    res.json({ ok: true })
  }
)

adminRouter.post('/backfill/cost-snapshots', requireAuth, requireAdmin, (req, res) => {
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
  const db = getDb()
  const r = backfillUsageLogCostSnapshots(db, { limit })
  res.json({ ok: true, scanned: r.scanned, updated: r.updated })
})

adminRouter.get('/audit-logs', requireAuth, requireAdmin, (req, res) => {
  const page = typeof req.query.page === 'string' ? Number(req.query.page) : 0
  const pageSize = typeof req.query.pageSize === 'string' ? Number(req.query.pageSize) : 50

  const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(200, Math.floor(pageSize)) : 50

  const { whereSql, params } = buildAuditLogWhere(req.query)
  const db = getDb()
  const totalRow = db.prepare(`select count(1) as c from audit_logs ${whereSql}`).get(...params) as { c: number } | undefined
  const total = typeof totalRow?.c === 'number' ? totalRow.c : 0

  const offset = safePage * safePageSize
  const rows = db
    .prepare(`select * from audit_logs ${whereSql} order by at desc limit ? offset ?`)
    .all(...params, safePageSize, offset) as AuditLogRow[]

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
      before: parseJson<unknown>(r.before_json),
      after: parseJson<unknown>(r.after_json),
    })),
  })
})

const csvEscape = (v: unknown) => {
  const s = v === null || typeof v === 'undefined' ? '' : String(v)
  const neutralized = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  const needs = /[",\n\r]/.test(neutralized)
  const out = neutralized.replace(/"/g, '""')
  return needs ? `"${out}"` : out
}

adminRouter.get('/audit-logs/export', requireAuth, requireAdmin, (req, res) => {
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 2000
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(5000, Math.floor(limit)) : 2000

  const { whereSql, params } = buildAuditLogWhere(req.query)
  const db = getDb()
  const rows = db
    .prepare(`select * from audit_logs ${whereSql} order by at desc limit ?`)
    .all(...params, safeLimit) as AuditLogRow[]

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
    .all(...(status ? [status] : [])) as Array<Omit<UserRow, 'password_hash'>>
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      username: r.username,
      role: r.role,
      status: r.status,
      approvedBy: r.approved_by ?? undefined,
      approvedAt: r.approved_at ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at ?? undefined,
    })),
  })
})

const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
  role: assignRoleSchema,
})

adminRouter.post(
  '/users',
  requireAuth,
  requireAdmin,
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const d = req.body as z.infer<typeof createUserSchema>
    const db = getDb()
    const exists = db.prepare('select 1 as ok from users where username = ?').get(d.username) as { ok: 1 } | undefined
    if (exists?.ok === 1) return res.status(400).json({ error: 'username_taken' })
    const hash = await hashPassword(d.password)
    const now = new Date().toISOString()
    const id = randomToken(16)
    try {
      db.prepare(
        'insert into users (id, username, password_hash, role, status, approved_by, approved_at, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, d.username, hash, d.role, 'active', req.user!.id, now, now, now)
    } catch (e: unknown) {
      const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: unknown }).code : undefined
      if (code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: 'username_taken' })
      throw e
    }
    writeAuditFromReq(db, req, {
      action: 'user.create',
      entityType: 'user',
      entityId: id,
      after: { username: d.username, role: d.role, status: 'active' },
    })
    res.json({ id })
  })
)

const approveSchema = z.object({ role: assignRoleSchema })

adminRouter.post('/users/:id/approve', requireAuth, requireAdmin, validateBody(approveSchema), (req, res) => {
  const d = req.body as z.infer<typeof approveSchema>
  const id = req.params.id
  const db = getDb()
  const now = new Date().toISOString()
  const row = db.prepare('select id, username, role, status from users where id = ?').get(id) as
    | { id: string; username: string; role: string; status?: string }
    | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  db.prepare('update users set status = ?, role = ?, approved_by = ?, approved_at = ?, updated_at = ? where id = ?').run(
    'active',
    d.role,
    req.user!.id,
    now,
    now,
    id
  )
  writeAuditFromReq(db, req, {
    action: 'user.approve',
    entityType: 'user',
    entityId: id,
    before: { username: row.username, role: row.role, status: row.status ?? null },
    after: { username: row.username, role: d.role, status: 'active' },
  })
  res.json({ ok: true })
})

adminRouter.post('/users/:id/disable', requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id
  const db = getDb()
  const row = db.prepare('select id, username, role, status from users where id = ?').get(id) as
    | { id: string; username: string; role: string; status?: string }
    | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.role === 'admin') return res.status(400).json({ error: 'cannot_disable_admin' })
  db.transaction(() => {
    db.prepare('update users set status = ?, updated_at = ? where id = ?').run('disabled', new Date().toISOString(), id)
    db.prepare('delete from auth_sessions where user_id = ?').run(id)
  })()
  writeAuditFromReq(db, req, {
    action: 'user.disable',
    entityType: 'user',
    entityId: id,
    before: { username: row.username, role: row.role, status: row.status ?? null },
    after: { username: row.username, role: row.role, status: 'disabled' },
  })
  res.json({ ok: true })
})

const resetPasswordSchema = z.object({ newPassword: z.string().min(8) })
const setUserRoleSchema = z.object({ role: assignRoleSchema })

adminRouter.patch('/users/:id', requireAuth, requireAdmin, validateBody(setUserRoleSchema), (req, res) => {
  const d = req.body as z.infer<typeof setUserRoleSchema>
  const id = req.params.id
  const db = getDb()
  const row = db.prepare('select id, username, role from users where id = ?').get(id) as
    | { id: string; username: string; role: string }
    | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.role === 'admin') return res.status(400).json({ error: 'cannot_change_admin_role' })
  db.transaction(() => {
    db.prepare('update users set role = ?, updated_at = ? where id = ?').run(d.role, new Date().toISOString(), id)
    db.prepare('delete from auth_sessions where user_id = ?').run(id)
  })()
  writeAuditFromReq(db, req, {
    action: 'user.role_change',
    entityType: 'user',
    entityId: id,
    before: { username: row.username, role: row.role },
    after: { username: row.username, role: d.role },
  })
  res.json({ ok: true })
})

adminRouter.post(
  '/users/:id/reset-password',
  requireAuth,
  requireAdmin,
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const d = req.body as z.infer<typeof resetPasswordSchema>
    const id = req.params.id
    const db = getDb()
    const row = db.prepare('select id, username, role from users where id = ?').get(id) as
      | { id: string; username: string; role: string }
      | undefined
    if (!row) return res.status(404).json({ error: 'not_found' })
    if (row.role === 'admin') return res.status(400).json({ error: 'cannot_reset_admin_password' })
    const hash = await hashPassword(d.newPassword)
    db.transaction(() => {
      db.prepare('update users set password_hash = ?, updated_at = ? where id = ?').run(hash, new Date().toISOString(), id)
      db.prepare('delete from auth_sessions where user_id = ?').run(id)
    })()
    writeAuditFromReq(db, req, {
      action: 'user.reset_password',
      entityType: 'user',
      entityId: id,
      after: { username: row.username },
    })
    res.json({ ok: true })
  })
)
