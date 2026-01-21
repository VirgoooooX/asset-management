import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireManager } from '../middlewares/requireManager.js'
import { getDb } from '../../db/db.js'
import { randomToken } from '../../util/crypto.js'

export const testProjectsRouter = Router()

const testProjectCreateSchema = z.object({
  name: z.string().min(1),
  temperature: z.number(),
  humidity: z.number(),
  duration: z.number().int(),
  projectId: z.string().optional()
})

const testProjectPatchSchema = testProjectCreateSchema.partial()

const mapRow = (r: any) => ({
  id: r.id,
  name: r.name,
  temperature: r.temperature,
  humidity: r.humidity,
  duration: r.duration,
  projectId: r.project_id ?? undefined,
  createdAt: r.created_at
})

testProjectsRouter.get('/', requireAuth, (_req, res) => {
  const db = getDb()
  const rows = db.prepare('select * from test_projects order by created_at desc').all() as any[]
  res.json({ items: rows.map(mapRow) })
})

testProjectsRouter.get('/:id', requireAuth, (req, res) => {
  const db = getDb()
  const row = db.prepare('select * from test_projects where id = ?').get(req.params.id) as any | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  res.json({ item: mapRow(row) })
})

testProjectsRouter.post('/', requireAuth, requireManager, (req, res) => {
  const body = testProjectCreateSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const id = randomToken(16)
  const now = new Date().toISOString()
  db.prepare(
    'insert into test_projects (id, name, temperature, humidity, duration, project_id, created_at) values (?,?,?,?,?,?,?)'
  ).run(id, d.name, d.temperature, d.humidity, d.duration, d.projectId ?? null, now)
  res.json({ id })
})

testProjectsRouter.patch('/:id', requireAuth, requireManager, (req, res) => {
  const id = req.params.id
  const body = testProjectPatchSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const exists = db.prepare('select 1 as ok from test_projects where id = ?').get(id) as { ok: 1 } | undefined
  if (!exists) return res.status(404).json({ error: 'not_found' })

  const updates: string[] = []
  const params: any[] = []
  const add = (sql: string, val: any) => {
    updates.push(sql)
    params.push(val)
  }

  if (d.name !== undefined) add('name = ?', d.name)
  if (d.temperature !== undefined) add('temperature = ?', d.temperature)
  if (d.humidity !== undefined) add('humidity = ?', d.humidity)
  if (d.duration !== undefined) add('duration = ?', d.duration)
  if (d.projectId !== undefined) add('project_id = ?', d.projectId ?? null)

  if (!updates.length) return res.json({ ok: true })
  db.prepare(`update test_projects set ${updates.join(', ')} where id = ?`).run(...params, id)
  res.json({ ok: true })
})

testProjectsRouter.delete('/:id', requireAuth, requireManager, (req, res) => {
  const id = req.params.id
  const db = getDb()
  db.prepare('delete from test_projects where id = ?').run(id)
  res.json({ ok: true })
})
