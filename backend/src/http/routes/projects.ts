import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireAdmin } from '../middlewares/requireAdmin.js'
import { getDb } from '../../db/db.js'
import { randomToken } from '../../util/crypto.js'
import { parseJson } from '../../util/json.js'

export const projectsRouter = Router()

const configSchema = z.object({
  id: z.string(),
  name: z.string(),
  remark: z.string().optional()
})

const projectCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  customerName: z.string().optional(),
  configs: z.array(configSchema).optional(),
  wfs: z.array(z.string()).optional()
})

const projectPatchSchema = projectCreateSchema.partial()

const mapRow = (r: any) => ({
  id: r.id,
  name: r.name,
  description: r.description ?? undefined,
  customerName: r.customer_name ?? undefined,
  configs: parseJson<any[]>(r.configs, undefined as any),
  wfs: parseJson<string[]>(r.wfs, undefined as any),
  createdAt: r.created_at
})

projectsRouter.get('/', requireAuth, (_req, res) => {
  const db = getDb()
  const rows = db.prepare('select * from projects order by created_at desc').all() as any[]
  res.json({ items: rows.map(mapRow) })
})

projectsRouter.get('/:id', requireAuth, (req, res) => {
  const db = getDb()
  const row = db.prepare('select * from projects where id = ?').get(req.params.id) as any | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  res.json({ item: mapRow(row) })
})

projectsRouter.post('/', requireAuth, requireAdmin, (req, res) => {
  const body = projectCreateSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const id = randomToken(16)
  const now = new Date().toISOString()
  db.prepare(
    'insert into projects (id, name, description, customer_name, configs, wfs, created_at) values (?,?,?,?,?,?,?)'
  ).run(
    id,
    d.name,
    d.description ?? null,
    d.customerName ?? null,
    d.configs ? JSON.stringify(d.configs) : null,
    d.wfs ? JSON.stringify(d.wfs) : null,
    now
  )
  res.json({ id })
})

projectsRouter.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id
  const body = projectPatchSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const exists = db.prepare('select 1 as ok from projects where id = ?').get(id) as { ok: 1 } | undefined
  if (!exists) return res.status(404).json({ error: 'not_found' })

  const updates: string[] = []
  const params: any[] = []
  const add = (sql: string, val: any) => {
    updates.push(sql)
    params.push(val)
  }

  if (d.name !== undefined) add('name = ?', d.name)
  if (d.description !== undefined) add('description = ?', d.description ?? null)
  if (d.customerName !== undefined) add('customer_name = ?', d.customerName ?? null)
  if (d.configs !== undefined) add('configs = ?', d.configs ? JSON.stringify(d.configs) : null)
  if (d.wfs !== undefined) add('wfs = ?', d.wfs ? JSON.stringify(d.wfs) : null)

  if (!updates.length) return res.json({ ok: true })
  db.prepare(`update projects set ${updates.join(', ')} where id = ?`).run(...params, id)
  res.json({ ok: true })
})

projectsRouter.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id
  const db = getDb()
  db.prepare('delete from projects where id = ?').run(id)
  res.json({ ok: true })
})

