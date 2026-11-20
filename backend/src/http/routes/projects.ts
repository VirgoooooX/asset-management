import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireManager } from '../middlewares/requireManager.js'
import { validateBody } from '../middlewares/validate.js'
import { getDb } from '../../db/db.js'
import { buildPatchSet, type PatchFieldSpec } from '../../db/sqlHelpers.js'
import { randomToken } from '../../util/crypto.js'
import { parseJson } from '../../util/json.js'
import type { ProjectConfigDto, ProjectRow } from '../../types.js'

export const projectsRouter = Router()

const configSchema = z.object({
  id: z.string(),
  name: z.string(),
  remark: z.string().optional(),
})

const projectCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  customerName: z.string().optional(),
  configs: z.array(configSchema).optional(),
  wfs: z.array(z.string()).optional(),
})

const projectPatchSchema = projectCreateSchema.partial()

const PROJECT_PATCH_SPECS: Record<string, PatchFieldSpec> = {
  name: { column: 'name' },
  description: { column: 'description', nullable: true },
  customerName: { column: 'customer_name', nullable: true },
  configs: { column: 'configs', json: true, nullable: true },
  wfs: { column: 'wfs', json: true, nullable: true },
}

const mapRow = (r: ProjectRow) => ({
  id: r.id,
  name: r.name,
  description: r.description ?? undefined,
  customerName: r.customer_name ?? undefined,
  configs: parseJson<ProjectConfigDto[]>(r.configs),
  wfs: parseJson<string[]>(r.wfs),
  createdAt: r.created_at,
})

projectsRouter.get('/', requireAuth, (_req, res) => {
  const db = getDb()
  const rows = db.prepare('select * from projects order by created_at desc').all() as ProjectRow[]
  res.json({ items: rows.map(mapRow) })
})

projectsRouter.get('/:id', requireAuth, (req, res) => {
  const db = getDb()
  const row = db.prepare('select * from projects where id = ?').get(req.params.id) as ProjectRow | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  res.json({ item: mapRow(row) })
})

projectsRouter.post('/', requireAuth, requireManager, validateBody(projectCreateSchema), (req, res) => {
  const d = req.body as z.infer<typeof projectCreateSchema>
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
  const created = db.prepare('select * from projects where id = ?').get(id) as ProjectRow | undefined
  res.json({ id, item: created ? mapRow(created) : undefined })
})

projectsRouter.patch('/:id', requireAuth, requireManager, validateBody(projectPatchSchema), (req, res) => {
  const id = req.params.id
  const d = req.body as z.infer<typeof projectPatchSchema>
  const db = getDb()
  const existing = db.prepare('select * from projects where id = ?').get(id) as ProjectRow | undefined
  if (!existing) return res.status(404).json({ error: 'not_found' })

  const { sets, params } = buildPatchSet(d as Record<string, unknown>, PROJECT_PATCH_SPECS)
  if (!sets.length) return res.json({ ok: true, item: mapRow(existing) })
  db.prepare(`update projects set ${sets.join(', ')} where id = ?`).run(...params, id)
  const updated = db.prepare('select * from projects where id = ?').get(id) as ProjectRow | undefined
  res.json({ ok: true, item: updated ? mapRow(updated) : undefined })
})

projectsRouter.delete('/:id', requireAuth, requireManager, (req, res) => {
  const id = req.params.id
  const db = getDb()
  db.prepare('delete from projects where id = ?').run(id)
  res.json({ ok: true })
})
