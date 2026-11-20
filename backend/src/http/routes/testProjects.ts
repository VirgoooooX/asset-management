import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireManager } from '../middlewares/requireManager.js'
import { validateBody } from '../middlewares/validate.js'
import { getDb } from '../../db/db.js'
import { buildPatchSet, type PatchFieldSpec } from '../../db/sqlHelpers.js'
import { randomToken } from '../../util/crypto.js'
import { parseJson } from '../../util/json.js'
import type { TestProjectRow, TestStageDto } from '../../types.js'

export const testProjectsRouter = Router()

const testProjectCreateSchema = z.object({
  name: z.string().min(1),
  temperature: z.number(),
  humidity: z.number(),
  duration: z.number().int(),
  projectId: z.string().optional(),
  assetCategories: z.array(z.string()).optional(),
  procedure: z.string().optional(),
  stages: z.array(z.unknown()).optional(),
})

const testProjectPatchSchema = testProjectCreateSchema.partial()

const TEST_PROJECT_PATCH_SPECS: Record<string, PatchFieldSpec> = {
  name: { column: 'name' },
  temperature: { column: 'temperature' },
  humidity: { column: 'humidity' },
  duration: { column: 'duration' },
  projectId: { column: 'project_id', nullable: true },
  assetCategories: { column: 'asset_categories', json: true, nullable: true },
  procedure: { column: 'procedure', nullable: true },
  stages: { column: 'stages', json: true, nullable: true },
}

const mapRow = (r: TestProjectRow) => ({
  id: r.id,
  name: r.name,
  temperature: r.temperature,
  humidity: r.humidity,
  duration: r.duration,
  projectId: r.project_id ?? undefined,
  assetCategories: parseJson<string[]>(r.asset_categories),
  procedure: r.procedure ?? undefined,
  stages: parseJson<TestStageDto[]>(r.stages),
  createdAt: r.created_at,
})

testProjectsRouter.get('/', requireAuth, (_req, res) => {
  const db = getDb()
  const rows = db.prepare('select * from test_projects order by created_at desc').all() as TestProjectRow[]
  res.json({ items: rows.map(mapRow) })
})

testProjectsRouter.get('/:id', requireAuth, (req, res) => {
  const db = getDb()
  const row = db.prepare('select * from test_projects where id = ?').get(req.params.id) as TestProjectRow | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  res.json({ item: mapRow(row) })
})

testProjectsRouter.post('/', requireAuth, requireManager, validateBody(testProjectCreateSchema), (req, res) => {
  const d = req.body as z.infer<typeof testProjectCreateSchema>
  const db = getDb()
  const id = randomToken(16)
  const now = new Date().toISOString()
  db.prepare(
    'insert into test_projects (id, name, temperature, humidity, duration, project_id, asset_categories, procedure, stages, created_at) values (?,?,?,?,?,?,?,?,?,?)'
  ).run(
    id,
    d.name,
    d.temperature,
    d.humidity,
    d.duration,
    d.projectId ?? null,
    d.assetCategories ? JSON.stringify(d.assetCategories) : null,
    d.procedure ?? null,
    d.stages ? JSON.stringify(d.stages) : null,
    now
  )
  const created = db.prepare('select * from test_projects where id = ?').get(id) as TestProjectRow | undefined
  res.json({ id, item: created ? mapRow(created) : undefined })
})

testProjectsRouter.patch('/:id', requireAuth, requireManager, validateBody(testProjectPatchSchema), (req, res) => {
  const id = req.params.id
  const d = req.body as z.infer<typeof testProjectPatchSchema>
  const db = getDb()
  const existing = db.prepare('select * from test_projects where id = ?').get(id) as TestProjectRow | undefined
  if (!existing) return res.status(404).json({ error: 'not_found' })

  const { sets, params } = buildPatchSet(d as Record<string, unknown>, TEST_PROJECT_PATCH_SPECS)
  if (!sets.length) return res.json({ ok: true, item: mapRow(existing) })
  db.prepare(`update test_projects set ${sets.join(', ')} where id = ?`).run(...params, id)
  const updated = db.prepare('select * from test_projects where id = ?').get(id) as TestProjectRow | undefined
  res.json({ ok: true, item: updated ? mapRow(updated) : undefined })
})

testProjectsRouter.delete('/:id', requireAuth, requireManager, (req, res) => {
  const id = req.params.id
  const db = getDb()
  db.prepare('delete from test_projects where id = ?').run(id)
  res.json({ ok: true })
})
