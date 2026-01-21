import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAuth } from '../middlewares/requireAuth.js'
import { getDb } from '../../db/db.js'

export const usersMeRouter = Router()

usersMeRouter.get('/', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

usersMeRouter.get('/preferences', requireAuth, (req, res) => {
  const db = getDb()
  const row = db.prepare('select data from user_preferences where user_id = ?').get(req.user!.id) as
    | { data: string }
    | undefined
  if (!row?.data) return res.json({ preferences: {} })
  try {
    const data = JSON.parse(row.data)
    res.json({ preferences: data && typeof data === 'object' ? data : {} })
  } catch {
    res.json({ preferences: {} })
  }
})

const preferencesSchema = z.record(z.string(), z.unknown())

usersMeRouter.put('/preferences', requireAuth, (req, res) => {
  const body = preferencesSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(
    'insert into user_preferences (user_id, data, updated_at) values (?, ?, ?) on conflict(user_id) do update set data=excluded.data, updated_at=excluded.updated_at'
  ).run(req.user!.id, JSON.stringify(body.data), now)
  res.json({ ok: true })
})

const passwordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8)
})

usersMeRouter.put('/password', requireAuth, async (req, res) => {
  const body = passwordSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const db = getDb()
  const row = db.prepare('select password_hash from users where id = ?').get(req.user!.id) as
    | { password_hash: string }
    | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  const ok = await bcrypt.compare(body.data.oldPassword, row.password_hash)
  if (!ok) return res.status(400).json({ error: 'invalid_old_password' })
  const hash = await bcrypt.hash(body.data.newPassword, 12)
  db.prepare('update users set password_hash = ?, updated_at = ? where id = ?').run(hash, new Date().toISOString(), req.user!.id)
  res.json({ ok: true })
})

