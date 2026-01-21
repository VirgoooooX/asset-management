import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireAdmin } from '../middlewares/requireAdmin.js'
import { getDb } from '../../db/db.js'
import { recomputeChamberStatus } from '../../services/assetStatus.js'

export const adminRouter = Router()

adminRouter.post('/reconcile/asset-status', requireAuth, requireAdmin, (_req, res) => {
  const db = getDb()
  const assets = db.prepare("select id from assets where type = 'chamber'").all() as { id: string }[]
  let updated = 0
  for (const a of assets) {
    const r = recomputeChamberStatus(db, a.id)
    if (r.updated) updated += 1
  }
  res.json({ ok: true, scanned: assets.length, updated })
})

