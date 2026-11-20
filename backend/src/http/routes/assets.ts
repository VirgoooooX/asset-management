import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { z } from 'zod'
import { config } from '../../config.js'
import { getDb } from '../../db/db.js'
import { buildPatchSet, type PatchFieldSpec } from '../../db/sqlHelpers.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireManager } from '../middlewares/requireManager.js'
import { asyncHandler } from '../middlewares/asyncHandler.js'
import { validateBody } from '../middlewares/validate.js'
import { assetStatusSchema, assetTypeSchema, attachmentSchema } from '../schemas.js'
import { randomToken } from '../../util/crypto.js'
import { parseJson } from '../../util/json.js'
import { isSubPath } from '../../util/pathSafe.js'
import { publishAssetStatusChanged, publishAssetUpdated } from '../../services/events.js'
import { writeAuditFromReq } from '../../services/auditLog.js'
import type { AssetRow, AttachmentDto } from '../../types.js'

export const assetsRouter = Router()

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
  capabilities: z.unknown().optional(),
  calibrationDate: z.string().optional().nullable(),
})

const assetPatchSchema = assetCreateSchema.partial().extend({
  capabilities: z.unknown().optional().nullable(),
  calibrationDate: z.string().optional().nullable(),
})

const ASSET_PATCH_SPECS: Record<string, PatchFieldSpec> = {
  type: { column: 'type' },
  name: { column: 'name' },
  status: { column: 'status' },
  hourlyRateCents: { column: 'hourly_rate_cents' },
  category: { column: 'category', nullable: true },
  assetCode: { column: 'asset_code', nullable: true },
  description: { column: 'description', nullable: true },
  tags: { column: 'tags', json: true, nullable: true },
  location: { column: 'location', nullable: true },
  serialNumber: { column: 'serial_number', nullable: true },
  manufacturer: { column: 'manufacturer', nullable: true },
  model: { column: 'model', nullable: true },
  owner: { column: 'owner', nullable: true },
  photoUrls: { column: 'photo_urls', json: true, nullable: true },
  nameplateUrls: { column: 'nameplate_urls', json: true, nullable: true },
  attachments: { column: 'attachments', json: true, nullable: true },
  capabilities: { column: 'capabilities', json: true, nullable: true },
  calibrationDate: { column: 'calibration_date', nullable: true },
}

const mapRowToAsset = (r: AssetRow) => ({
  id: r.id,
  type: r.type,
  name: r.name,
  status: r.status,
  hourlyRateCents: typeof r.hourly_rate_cents === 'number' ? r.hourly_rate_cents : 0,
  category: r.category ?? undefined,
  assetCode: r.asset_code ?? undefined,
  description: r.description ?? undefined,
  tags: parseJson<string[]>(r.tags),
  location: r.location ?? undefined,
  serialNumber: r.serial_number ?? undefined,
  manufacturer: r.manufacturer ?? undefined,
  model: r.model ?? undefined,
  owner: r.owner ?? undefined,
  photoUrls: parseJson<string[]>(r.photo_urls),
  nameplateUrls: parseJson<string[]>(r.nameplate_urls),
  attachments: parseJson<AttachmentDto[]>(r.attachments),
  capabilities: parseJson<unknown>(r.capabilities),
  calibrationDate: r.calibration_date ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at ?? undefined,
})

const auditSnapshot = (row: {
  name?: string | null
  category?: string | null
  status?: string | null
  hourly_rate_cents?: number | null
  calibration_date?: string | null
}) => ({
  name: row.name ?? null,
  category: row.category ?? null,
  status: row.status ?? null,
  hourlyRateCents: typeof row.hourly_rate_cents === 'number' ? row.hourly_rate_cents : 0,
  calibrationDate: row.calibration_date ?? null,
})

assetsRouter.get('/', requireAuth, (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type : undefined
  const db = getDb()
  const rows = type
    ? (db.prepare('select * from assets where type = ? order by created_at desc').all(type) as AssetRow[])
    : (db.prepare('select * from assets order by created_at desc').all() as AssetRow[])
  res.json({ items: rows.map(mapRowToAsset) })
})

assetsRouter.get('/:id', requireAuth, (req, res) => {
  const id = req.params.id
  const db = getDb()
  const row = db.prepare('select * from assets where id = ?').get(id) as AssetRow | undefined
  if (!row) return res.status(404).json({ error: 'not_found' })
  res.json({ item: mapRowToAsset(row) })
})

assetsRouter.post('/', requireAuth, requireManager, validateBody(assetCreateSchema), (req, res) => {
  const d = req.body as z.infer<typeof assetCreateSchema>
  const db = getDb()
  const id = randomToken(16)
  const now = new Date().toISOString()

  db.prepare(
    [
      'insert into assets (',
      'id, type, name, status, hourly_rate_cents, category, asset_code, description, tags, location, serial_number, manufacturer, model, owner, photo_urls, nameplate_urls, attachments, capabilities, calibration_date, created_at, updated_at',
      ') values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
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

  writeAuditFromReq(db, req, {
    action: 'asset.create',
    entityType: 'asset',
    entityId: id,
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

  const created = db.prepare('select * from assets where id = ?').get(id) as AssetRow | undefined
  res.json({ id, item: created ? mapRowToAsset(created) : undefined })
})

assetsRouter.patch('/:id', requireAuth, requireManager, validateBody(assetPatchSchema), (req, res) => {
  const id = req.params.id
  const d = req.body as z.infer<typeof assetPatchSchema>
  const db = getDb()
  const before = db
    .prepare('select name, category, status, hourly_rate_cents, calibration_date from assets where id = ?')
    .get(id) as
    | { name?: string | null; category?: string | null; status?: string | null; hourly_rate_cents?: number | null; calibration_date?: string | null }
    | undefined
  if (!before) return res.status(404).json({ error: 'not_found' })
  const beforeStatus = typeof before.status === 'string' ? before.status : undefined

  const now = new Date().toISOString()
  const { sets, params } = buildPatchSet(d as Record<string, unknown>, ASSET_PATCH_SPECS, [
    { column: 'updated_at', value: now },
  ])
  db.prepare(`update assets set ${sets.join(', ')} where id = ?`).run(...params, id)

  const afterRow = db.prepare('select * from assets where id = ?').get(id) as AssetRow | undefined

  const shouldAudit =
    d.name !== undefined ||
    d.status !== undefined ||
    d.category !== undefined ||
    d.hourlyRateCents !== undefined ||
    d.calibrationDate !== undefined

  if (shouldAudit) {
    writeAuditFromReq(db, req, {
      action: 'asset.update',
      entityType: 'asset',
      entityId: id,
      before: auditSnapshot(before),
      after: afterRow ? auditSnapshot(afterRow) : null,
    })
  }

  if (d.status !== undefined && beforeStatus && d.status !== beforeStatus) {
    publishAssetStatusChanged(id, d.status, now)
  }
  publishAssetUpdated(id, now)
  res.json({ ok: true, item: afterRow ? mapRowToAsset(afterRow) : undefined })
})

assetsRouter.delete(
  '/:id',
  requireAuth,
  requireManager,
  asyncHandler(async (req, res) => {
    const id = req.params.id
    const db = getDb()
    const before = db
      .prepare('select name, category, status, hourly_rate_cents, calibration_date from assets where id = ?')
      .get(id) as
      | { name?: string; category?: string; status?: string; hourly_rate_cents?: number; calibration_date?: string | null }
      | undefined
    db.prepare('delete from assets where id = ?').run(id)
    if (before) {
      writeAuditFromReq(db, req, {
        action: 'asset.delete',
        entityType: 'asset',
        entityId: id,
        before: auditSnapshot(before),
      })
      const assetFilesDir = path.join(config.filesDir, 'by-asset', id)
      if (isSubPath(config.filesDir, assetFilesDir)) {
        await fs.promises.rm(assetFilesDir, { recursive: true, force: true }).catch(() => undefined)
      }
    }
    res.json({ ok: true })
  })
)
