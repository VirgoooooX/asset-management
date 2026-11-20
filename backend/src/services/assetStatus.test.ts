import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { recomputeChamberStatus } from './assetStatus'

const setupDb = () => {
  const db = new Database(':memory:')
  db.exec(`
    create table assets (
      id text primary key,
      type text not null,
      status text not null,
      updated_at text
    );
    create table usage_logs (
      id text primary key,
      chamber_id text not null,
      start_time text not null,
      end_time text,
      status text not null
    );
  `)
  return db
}

describe('recomputeChamberStatus', () => {
  it('marks chamber in-use for started uncompleted log even if end_time passed (overdue)', () => {
    const db = setupDb()
    db.prepare('insert into assets (id, type, status) values (?, ?, ?)').run('a1', 'chamber', 'available')
    const pastStart = new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    const pastEnd = new Date(Date.now() - 1 * 3600 * 1000).toISOString()
    db.prepare('insert into usage_logs (id, chamber_id, start_time, end_time, status) values (?, ?, ?, ?, ?)').run(
      'l1',
      'a1',
      pastStart,
      pastEnd,
      'in-progress'
    )

    const res = recomputeChamberStatus(db, 'a1')
    expect(res.updated).toBe(true)
    expect(res.targetStatus).toBe('in-use')
  })

  it('marks chamber available once log is completed', () => {
    const db = setupDb()
    db.prepare('insert into assets (id, type, status) values (?, ?, ?)').run('a1', 'chamber', 'in-use')
    const pastStart = new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    const pastEnd = new Date(Date.now() - 1 * 3600 * 1000).toISOString()
    db.prepare('insert into usage_logs (id, chamber_id, start_time, end_time, status) values (?, ?, ?, ?, ?)').run(
      'l1',
      'a1',
      pastStart,
      pastEnd,
      'completed'
    )

    const res = recomputeChamberStatus(db, 'a1')
    expect(res.updated).toBe(true)
    expect(res.targetStatus).toBe('available')
  })

  it('preserves maintenance status', () => {
    const db = setupDb()
    db.prepare('insert into assets (id, type, status) values (?, ?, ?)').run('a1', 'chamber', 'maintenance')
    const res = recomputeChamberStatus(db, 'a1')
    expect(res.updated).toBe(false)
    expect(res.targetStatus).toBe('maintenance')
  })
})
