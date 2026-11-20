import { getDb } from '../db/db.js'
import { config } from '../config.js'
import { randomToken } from '../util/crypto.js'
import { hashPassword } from '../util/password.js'

export const ensureAdminSeed = async () => {
  const db = getDb()
  const anyAdmin = db.prepare("select id, username from users where role = 'admin' limit 1").get() as
    | { id: string; username: string }
    | undefined
  if (anyAdmin) {
    if (!config.adminSeedPassword || !config.adminSeedResetPassword) return
    const preferred = db
      .prepare("select id, username from users where role = 'admin' and username = ? limit 1")
      .get(config.adminSeedUser) as { id: string; username: string } | undefined
    const target = preferred ?? anyAdmin
    const hash = await hashPassword(config.adminSeedPassword)
    db.prepare('update users set password_hash = ?, updated_at = ? where id = ?').run(hash, new Date().toISOString(), target.id)
    return
  }
  const exists = db.prepare('select 1 as ok from users where username = ?').get(config.adminSeedUser) as
    | { ok: 1 }
    | undefined
  if (exists?.ok === 1) return
  if (!config.adminSeedPassword) return
  const hash = await hashPassword(config.adminSeedPassword)
  const now = new Date().toISOString()
  db.prepare(
    'insert into users (id, username, password_hash, role, status, approved_by, approved_at, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(randomToken(16), config.adminSeedUser, hash, 'admin', 'active', null, now, now)
}
