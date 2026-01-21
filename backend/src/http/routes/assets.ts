import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../../db/db.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireManager } from '../middlewares/requireManager.js'
import { randomToken } from '../../util/crypto.js'
import { parseJson } from '../../util/json.js'
import { syncAssetFolderToPreferred } from '../../services/fileFolders.js'
import { slugifyCategory } from '../../util/slug.js'

export const assetsRouter = Router()

const assetTypeSchema = z.enum(['chamber'])
const assetStatusSchema = z.enum(['available', 'in-use', 'maintenance'])

const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  path: z.string(),
  contentType: z.string().optional(),
  size: z.number().optional(),
  uploadedAt: z.string()
})

const assetCreateSchema = z.object({
  type: assetTypeSchema,
  name: z.string().min(1),
  status: assetStatusSchema,
  category: z.string().optional(),
  assetCode: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  location: z.string().optional(),
  serialNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  owner: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
  nameplateUrls: z.array(z.string()).optional(),
  attachments: z.array(attachmentSchema).optional(),
  calibrationDate: z.string().optional().nullable()
})

const assetPatchSchema = assetCreateSchema.partial().extend({
  calibrationDate: z.string().optional().nullable()
})

const mapRowToAsset = (r: any) => ({
  id: r.id,
  type: r.type,
  name: r.name,
  status: r.status,
  category: r.category ?? undefined,
  assetCode: r.asset_code ?? undefined,
  description: r.description ?? undefined,
  tags: parseJson<string[]>(r.tags, undefined as any),
  location: r.location ?? undefined,
  serialNumber: r.serial_number ?? undefined,
  manufacturer: r.manufacturer ?? undefined,
  model: r.model ?? undefined,
  owner: r.owner ?? undefined,
  photoUrls: parseJson<string[]>(r.photo_urls, undefined as any),
  nameplateUrls: parseJson<string[]>(r.nameplate_urls, undefined as any),
  attachments: parseJson<any[]>(r.attachments, undefined as any),
  calibrationDate: r.calibration_date ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at ?? undefined
})

assetsRouter.get('/', requireAuth, (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined
  const db = getDb()
  const rows = type
    ? (db.prepare('select * from assets where type = ? order by created_at desc').all(type) as any[])
    : (db.prepare('select * from assets order by created_at desc').all() as any[])
  res.json({ items: rows.map(mapRowToAsset) })
})

assetsRouter.get('/:id', requireAuth, (req, res) => {
  const id = req.params.id
  const db = getDb()
  const row = db.prepare('select * from assets where id = ?').get(id) as any | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  res.json({ item: mapRowToAsset(row) })
})

assetsRouter.post('/', requireAuth, requireManager, (req, res) => {
  const body = assetCreateSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const id = randomToken(16)
  const now = new Date().toISOString()

  db.prepare(
    [
      'insert into assets (',
      'id, type, name, status, category, asset_code, description, tags, location, serial_number, manufacturer, model, owner, photo_urls, nameplate_urls, attachments, calibration_date, created_at, updated_at',
      ') values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ].join(' ')
  ).run(
    id,
    d.type,
    d.name,
    d.status,
    d.category ?? null,
    d.assetCode ?? null,
    d.description ?? null,
    d.tags ? JSON.stringify(d.tags) : null,
    d.location ?? null,
    d.serialNumber ?? null,
    d.manufacturer ?? null,
    d.model ?? null,
    d.owner ?? null,
    d.photoUrls ? JSON.stringify(d.photoUrls) : null,
    d.nameplateUrls ? JSON.stringify(d.nameplateUrls) : null,
    d.attachments ? JSON.stringify(d.attachments) : null,
    d.calibrationDate ?? null,
    now,
    now
  )

  res.json({ id })
})

assetsRouter.patch('/:id', requireAuth, requireManager, async (req, res) => {
  const id = req.params.id
  const body = assetPatchSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const before = db.prepare('select category from assets where id = ?').get(id) as { category?: string } | undefined
  if (!before) return res.status(404).json({ error: 'not_found' })
  const beforeCategory = typeof before?.category === 'string' ? before.category : ''
  const beforeCategorySlug = slugifyCategory(beforeCategory)

  const updates: string[] = []
  const params: any[] = []
  const add = (sql: string, val: any) => {
    updates.push(sql)
    params.push(val)
  }

  if (d.type !== undefined) add('type = ?', d.type)
  if (d.name !== undefined) add('name = ?', d.name)
  if (d.status !== undefined) add('status = ?', d.status)
  if (d.category !== undefined) add('category = ?', d.category ?? null)
  if (d.assetCode !== undefined) add('asset_code = ?', d.assetCode ?? null)
  if (d.description !== undefined) add('description = ?', d.description ?? null)
  if (d.tags !== undefined) add('tags = ?', d.tags ? JSON.stringify(d.tags) : null)
  if (d.location !== undefined) add('location = ?', d.location ?? null)
  if (d.serialNumber !== undefined) add('serial_number = ?', d.serialNumber ?? null)
  if (d.manufacturer !== undefined) add('manufacturer = ?', d.manufacturer ?? null)
  if (d.model !== undefined) add('model = ?', d.model ?? null)
  if (d.owner !== undefined) add('owner = ?', d.owner ?? null)
  if (d.photoUrls !== undefined) add('photo_urls = ?', d.photoUrls ? JSON.stringify(d.photoUrls) : null)
  if (d.nameplateUrls !== undefined) add('nameplate_urls = ?', d.nameplateUrls ? JSON.stringify(d.nameplateUrls) : null)
  if (d.attachments !== undefined) add('attachments = ?', d.attachments ? JSON.stringify(d.attachments) : null)
  if (d.calibrationDate !== undefined) add('calibration_date = ?', d.calibrationDate ?? null)

  add('updated_at = ?', new Date().toISOString())

  db.prepare(`update assets set ${updates.join(', ')} where id = ?`).run(...params, id)
  if (d.name !== undefined || d.category !== undefined) {
    await syncAssetFolderToPreferred(id, beforeCategorySlug).catch(() => undefined)
  }
  res.json({ ok: true })
})

assetsRouter.delete('/:id', requireAuth, requireManager, (req, res) => {
  const id = req.params.id
  const db = getDb()
  db.prepare('delete from assets where id = ?').run(id)
  res.json({ ok: true })
})
