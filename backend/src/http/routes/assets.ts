import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../../db/db.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireManager } from '../middlewares/requireManager.js'
import { randomToken } from '../../util/crypto.js'
import { parseJson } from '../../util/json.js'
import { syncAssetFolderToPreferred } from '../../services/fileFolders.js'
import { slugifyCategory } from '../../util/slug.js'
import { publishAssetStatusChanged, publishAssetUpdated } from '../../services/events.js'
import { writeAuditLog } from '../../services/auditLog.js'

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
  hourlyRateCents: z.number().int().min(0).optional(),
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
  capabilities: z.any().optional(),
  calibrationDate: z.string().optional().nullable()
})

const assetPatchSchema = assetCreateSchema.partial().extend({
  capabilities: z.any().optional().nullable(),
  calibrationDate: z.string().optional().nullable()
})

const mapRowToAsset = (r: any) => ({
  id: r.id,
  type: r.type,
  name: r.name,
  status: r.status,
  hourlyRateCents: typeof r.hourly_rate_cents === 'number' ? r.hourly_rate_cents : 0,
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
  capabilities: parseJson<any>(r.capabilities, undefined as any),
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
      'id, type, name, status, hourly_rate_cents, category, asset_code, description, tags, location, serial_number, manufacturer, model, owner, photo_urls, nameplate_urls, attachments, capabilities, calibration_date, created_at, updated_at',
      ') values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ].join(' ')
  ).run(
    id,
    d.type,
    d.name,
    d.status,
    d.hourlyRateCents ?? 0,
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
    d.capabilities ? JSON.stringify(d.capabilities) : null,
    d.calibrationDate ?? null,
    now,
    now
  )

  writeAuditLog(db, {
    actor: req.user!,
    action: 'asset.create',
    entityType: 'asset',
    entityId: id,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    requestId: req.requestId,
    after: {
      id,
      type: d.type,
      name: d.name,
      status: d.status,
      category: d.category ?? null,
      hourlyRateCents: d.hourlyRateCents ?? 0,
      calibrationDate: d.calibrationDate ?? null,
    },
  })

  res.json({ id })
})

assetsRouter.patch('/:id', requireAuth, requireManager, async (req, res) => {
  const id = req.params.id
  const body = assetPatchSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  const db = getDb()
  const before = db.prepare('select name, category, status, hourly_rate_cents, calibration_date from assets where id = ?').get(id) as
    | { name?: string; category?: string; status?: string; hourly_rate_cents?: number; calibration_date?: string | null }
    | undefined
  if (!before) return res.status(404).json({ error: 'not_found' })
  const beforeCategory = typeof before?.category === 'string' ? before.category : ''
  const beforeCategorySlug = slugifyCategory(beforeCategory)
  const beforeStatus = typeof before?.status === 'string' ? before.status : undefined

  const updates: string[] = []
  const params: any[] = []
  const add = (sql: string, val: any) => {
    updates.push(sql)
    params.push(val)
  }

  if (d.type !== undefined) add('type = ?', d.type)
  if (d.name !== undefined) add('name = ?', d.name)
  if (d.status !== undefined) add('status = ?', d.status)
  if (d.hourlyRateCents !== undefined) add('hourly_rate_cents = ?', d.hourlyRateCents)
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
  if (d.capabilities !== undefined) add('capabilities = ?', d.capabilities === null ? null : JSON.stringify(d.capabilities))
  if (d.calibrationDate !== undefined) add('calibration_date = ?', d.calibrationDate ?? null)

  const now = new Date().toISOString()
  add('updated_at = ?', now)

  db.prepare(`update assets set ${updates.join(', ')} where id = ?`).run(...params, id)

  const shouldAudit =
    d.name !== undefined ||
    d.status !== undefined ||
    d.category !== undefined ||
    d.hourlyRateCents !== undefined ||
    d.calibrationDate !== undefined

  if (shouldAudit) {
    const after = db.prepare('select name, category, status, hourly_rate_cents, calibration_date from assets where id = ?').get(id) as
      | { name?: string; category?: string; status?: string; hourly_rate_cents?: number; calibration_date?: string | null }
      | undefined
    writeAuditLog(db, {
      actor: req.user!,
      action: 'asset.update',
      entityType: 'asset',
      entityId: id,
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
      requestId: req.requestId,
      before: {
        name: before?.name ?? null,
        category: before?.category ?? null,
        status: before?.status ?? null,
        hourlyRateCents: typeof before?.hourly_rate_cents === 'number' ? before.hourly_rate_cents : 0,
        calibrationDate: before?.calibration_date ?? null,
      },
      after: after
        ? {
            name: after.name ?? null,
            category: after.category ?? null,
            status: after.status ?? null,
            hourlyRateCents: typeof after.hourly_rate_cents === 'number' ? after.hourly_rate_cents : 0,
            calibrationDate: after.calibration_date ?? null,
          }
        : null,
    })
  }

  if (d.status !== undefined && beforeStatus && d.status !== beforeStatus) {
    publishAssetStatusChanged(id, d.status, now)
  }
  publishAssetUpdated(id, now)
  if (d.name !== undefined || d.category !== undefined) {
    await syncAssetFolderToPreferred(id, beforeCategorySlug).catch(() => undefined)
  }
  res.json({ ok: true })
})

assetsRouter.delete('/:id', requireAuth, requireManager, (req, res) => {
  const id = req.params.id
  const db = getDb()
  const before = db.prepare('select name, category, status, hourly_rate_cents, calibration_date from assets where id = ?').get(id) as
    | { name?: string; category?: string; status?: string; hourly_rate_cents?: number; calibration_date?: string | null }
    | undefined
  db.prepare('delete from assets where id = ?').run(id)
  if (before) {
    writeAuditLog(db, {
      actor: req.user!,
      action: 'asset.delete',
      entityType: 'asset',
      entityId: id,
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
      requestId: req.requestId,
      before: {
        name: before.name ?? null,
        category: before.category ?? null,
        status: before.status ?? null,
        hourlyRateCents: typeof before.hourly_rate_cents === 'number' ? before.hourly_rate_cents : 0,
        calibrationDate: before.calibration_date ?? null,
      },
    })
  }
  res.json({ ok: true })
})
