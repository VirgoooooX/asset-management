import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../../db/db.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { validateBody } from '../middlewares/validate.js'

export const notificationsRouter = Router()

const idsSchema = z.object({ ids: z.array(z.string().min(1)).max(2000) })
const readOneSchema = z.object({ id: z.string().min(1) })

notificationsRouter.get('/reads', requireAuth, (req, res) => {
  const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 2000
  const limit = Number.isFinite(rawLimit) ? Math.min(5000, Math.max(1, Math.floor(rawLimit))) : 2000
  const db = getDb()
  const rows = db
    .prepare('select notification_id from notification_reads where user_id = ? order by read_at desc limit ?')
    .all(req.user!.id, limit) as Array<{ notification_id: string }>
  res.json({ ids: rows.map((r) => r.notification_id) })
})

notificationsRouter.post('/read', requireAuth, validateBody(readOneSchema), (req, res) => {
  const d = req.body as z.infer<typeof readOneSchema>
  const db = getDb()
  db.prepare(
    'insert into notification_reads (user_id, notification_id, read_at) values (?,?,?) on conflict(user_id, notification_id) do update set read_at = excluded.read_at'
  ).run(req.user!.id, d.id, new Date().toISOString())
  res.json({ ok: true })
})

notificationsRouter.post('/read-all', requireAuth, validateBody(idsSchema), (req, res) => {
  const { ids } = req.body as z.infer<typeof idsSchema>
  const db = getDb()
  const now = new Date().toISOString()
  db.transaction(() => {
    const stmt = db.prepare(
      'insert into notification_reads (user_id, notification_id, read_at) values (?,?,?) on conflict(user_id, notification_id) do update set read_at = excluded.read_at'
    )
    for (const id of ids) stmt.run(req.user!.id, id, now)
  })()
  res.json({ ok: true })
})
