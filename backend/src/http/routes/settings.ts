import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireAdmin } from '../middlewares/requireAdmin.js'
import { getDb } from '../../db/db.js'

export const settingsRouter = Router()

const DEFAULTS = {
  timelineDayStartHour: 7,
  defaultUsageLogDurationMinutes: 60
}

const getSettingNumber = (key: string, fallback: number) => {
  const db = getDb()
  const row = db.prepare('select value from settings where key = ?').get(key) as { value: string } | undefined
  if (!row?.value) return fallback
  try {
    const v = JSON.parse(row.value)
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback
  } catch {
    const asNum = Number(row.value)
    return Number.isFinite(asNum) ? asNum : fallback
  }
}

const setSettingNumber = (key: string, value: number) => {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(
    'insert into settings (key, value, updated_at) values (?, ?, ?) on conflict(key) do update set value=excluded.value, updated_at=excluded.updated_at'
  ).run(key, JSON.stringify(value), now)
}

settingsRouter.get('/', requireAuth, (_req, res) => {
  const timelineDayStartHour = getSettingNumber('timelineDayStartHour', DEFAULTS.timelineDayStartHour)
  const defaultUsageLogDurationMinutes = getSettingNumber(
    'defaultUsageLogDurationMinutes',
    DEFAULTS.defaultUsageLogDurationMinutes
  )
  res.json({ settings: { timelineDayStartHour, defaultUsageLogDurationMinutes } })
})

const patchSchema = z.object({
  timelineDayStartHour: z.number().int().min(0).max(23).optional(),
  defaultUsageLogDurationMinutes: z.number().int().min(1).max(24 * 60).optional()
})

settingsRouter.put('/', requireAuth, requireAdmin, (req, res) => {
  const body = patchSchema.safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'invalid_body' })
  const d = body.data
  if (d.timelineDayStartHour !== undefined) setSettingNumber('timelineDayStartHour', d.timelineDayStartHour)
  if (d.defaultUsageLogDurationMinutes !== undefined) {
    setSettingNumber('defaultUsageLogDurationMinutes', d.defaultUsageLogDurationMinutes)
  }
  res.json({ ok: true })
})

