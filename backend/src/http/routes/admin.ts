import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireAdmin } from '../middlewares/requireAdmin.js'
import { getDb } from '../../db/db.js'
import { recomputeChamberStatus } from '../../services/assetStatus.js'
import { randomToken } from '../../util/crypto.js'

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
