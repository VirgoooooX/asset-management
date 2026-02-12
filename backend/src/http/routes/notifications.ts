import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../../db/db.js'
import { requireAuth } from '../middlewares/requireAuth.js'

export const notificationsRouter = Router()

const idsSchema = z.object({ ids: z.array(z.string().min(1)).max(2000) })

notificationsRouter.get('/reads', requireAuth, (req, res) => {
  const limit = Math.min(5000, Math.max(1, Number(req.query.limit ?? 2000)))
  const db = getDb()
  const rows = db
    .prepare('select notification_id from notification_reads where user_id = ? order by read_at desc limit ?')
    .all(req.user!.id, limit) as Array<{ notification_id: string }>
  res.json({ ids: rows.map((r) => r.notification_id) })
})

notificationsRouter.post('/reads/query', requireAuth, (req, res) => {
  const parsed = idsSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' })
  const { ids } = parsed.data
  if (ids.length === 0) return res.json({ ids: [] })
  const db = getDb()
  const placeholders = ids.map(() => '?').join(',')
  const rows = db
    .prepare(`select notification_id from notification_reads where user_id = ? and notification_id in (${placeholders})`)
    .all(req.user!.id, ...ids) as Array<{ notification_id: string }>
  res.json({ ids: rows.map((r) => r.notification_id) })
})

notificationsRouter.post('/read', requireAuth, (req, res) => {
  const parsed = z.object({ id: z.string().min(1) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' })
  const db = getDb()
  db.prepare(
    'insert into notification_reads (user_id, notification_id, read_at) values (?,?,?) on conflict(user_id, notification_id) do update set read_at = excluded.read_at'
  ).run(req.user!.id, parsed.data.id, new Date().toISOString())
  res.json({ ok: true })
})

notificationsRouter.post('/read-all', requireAuth, (req, res) => {
  const parsed = idsSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' })
  const { ids } = parsed.data
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

