import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middlewares/requireAuth.js'
import { asyncHandler } from '../middlewares/asyncHandler.js'
import { validateBody } from '../middlewares/validate.js'
import { getDb } from '../../db/db.js'
import { hashPassword, verifyPassword } from '../../util/password.js'
import { parseJson } from '../../util/json.js'

export const usersMeRouter = Router()

usersMeRouter.get('/', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

usersMeRouter.get('/preferences', requireAuth, (req, res) => {
  const db = getDb()
  const row = db.prepare('select data from user_preferences where user_id = ?').get(req.user!.id) as
    | { data: string }
    | undefined
  const parsed = parseJson<Record<string, unknown>>(row?.data)
  res.json({ preferences: parsed && typeof parsed === 'object' ? parsed : {} })
})

const preferencesSchema = z.record(z.string(), z.unknown())

usersMeRouter.put('/preferences', requireAuth, validateBody(preferencesSchema), (req, res) => {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(
    'insert into user_preferences (user_id, data, updated_at) values (?, ?, ?) on conflict(user_id) do update set data=excluded.data, updated_at=excluded.updated_at'
  ).run(req.user!.id, JSON.stringify(req.body), now)
  res.json({ ok: true })
})

const passwordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

usersMeRouter.put(
  '/password',
  requireAuth,
  validateBody(passwordSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof passwordSchema>
    const db = getDb()
    const row = db.prepare('select password_hash from users where id = ?').get(req.user!.id) as
      | { password_hash: string }
      | undefined
    if (!row) return res.status(404).json({ error: 'not_found' })
    const verified = await verifyPassword(body.oldPassword, row.password_hash)
    if (!verified.ok) return res.status(400).json({ error: 'invalid_old_password' })
    const hash = await hashPassword(body.newPassword)
    db.transaction(() => {
      db.prepare('update users set password_hash = ?, updated_at = ? where id = ?').run(
        hash,
        new Date().toISOString(),
        req.user!.id
      )
      db.prepare('delete from auth_sessions where user_id = ?').run(req.user!.id)
    })()
    res.json({ ok: true })
  })
)
