import fs from 'node:fs'
import path from 'node:path'
import { getDb } from './db.js'

const ensureMigrationsTable = () => {
  const db = getDb()
  db.exec(
    [
      'create table if not exists schema_migrations (',
      '  version text primary key,',
      '  applied_at text not null',
      ')'
    ].join('\n')
  )
}

const getApplied = () => {
  const db = getDb()
  const rows = db.prepare('select version from schema_migrations').all() as { version: string }[]
  return new Set(rows.map((r) => r.version))
}

export const runMigrations = (migrationsDir: string) => {
  ensureMigrationsTable()
  const applied = getApplied()
  const db = getDb()
  const entries = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort()

  for (const file of entries) {
    const version = file.replace(/\.sql$/i, '')
    if (applied.has(version)) continue
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    db.transaction(() => {
      db.exec(sql)
      db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
        version,
        new Date().toISOString()
      )
    })()
  }
}

