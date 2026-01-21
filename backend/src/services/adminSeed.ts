import { getDb } from '../db/db.js'
import { config } from '../config.js'
import bcrypt from 'bcryptjs'
import { randomToken } from '../util/crypto.js'

export const ensureAdminSeed = async () => {
  const db = getDb()
  const anyAdmin = db.prepare("select 1 as ok from users where role = 'admin' limit 1").get() as { ok: 1 } | undefined
  if (anyAdmin?.ok === 1) return
  const exists = db.prepare('select 1 as ok from users where username = ?').get(config.adminSeedUser) as
    | { ok: 1 }
    | undefined
  if (exists?.ok === 1) return
  if (!config.adminSeedPassword) return
  const hash = await bcrypt.hash(config.adminSeedPassword, 12)
  db.prepare(
    'insert into users (id, username, password_hash, role, status, approved_by, approved_at, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(randomToken(16), config.adminSeedUser, hash, 'admin', 'active', null, new Date().toISOString(), new Date().toISOString())
}
