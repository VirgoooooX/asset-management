import { Router } from 'express'
import fs from 'node:fs'
import { config } from '../../config.js'
import { getDb } from '../../db/db.js'
import { asyncHandler } from '../middlewares/asyncHandler.js'

export const healthRouter = Router()

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    try {
      const db = getDb()
      const row = db.prepare('select 1 as ok').get() as { ok: 1 }
      await fs.promises.access(config.filesDir, fs.constants.W_OK)
      res.json({ ok: row.ok === 1, hasFilesDir: true })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e || '')
      res.status(500).json({ ok: false, error: message || 'unknown' })
    }
  })
)
