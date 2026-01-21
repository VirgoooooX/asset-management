import { Router } from 'express'
import fs from 'node:fs'
import { config } from '../../config.js'
import { getDb } from '../../db/db.js'

export const healthRouter = Router()

healthRouter.get('/', (_req, res) => {
  try {
    const db = getDb()
    const row = db.prepare('select 1 as ok').get() as { ok: 1 }
    fs.accessSync(config.filesDir, fs.constants.W_OK)
    res.json({ ok: row.ok === 1, hasFilesDir: true })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ? String(e.message) : 'unknown' })
  }
})

