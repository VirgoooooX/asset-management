import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../../db/db.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { toNotificationRecord } from '../../services/notificationService.js'

export const notificationsRouter = Router()

const idsSchema = z.object({ ids: z.array(z.string().min(1)).max(2000) })

notificationsRouter.get('/', requireAuth, (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)))
  const db = getDb()
  const rows = db
    .prepare(
      [
        'select n.*, case when nr.notification_id is not null then 1 else 0 end as delivered_to_user,',
        'case when r.notification_id is not null then 1 else 0 end as is_read',
        'from notifications n',
        'left join notification_recipients nr on nr.notification_id = n.id and nr.user_id = ?',
        'left join notification_reads r on r.notification_id = n.id and r.user_id = ?',
        'where nr.notification_id is not null',
        'order by n.created_at desc',
        'limit ?',
      ].join(' ')
    )
    .all(req.user!.id, req.user!.id, limit) as any[]

  res.json({
    items: rows.map((r) => ({
      ...toNotificationRecord(r),
      read: r.is_read === 1,
    })),
  })
})

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
