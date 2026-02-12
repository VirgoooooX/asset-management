import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { backfillUsageLogCostSnapshots } from './costSnapshotBackfill'

describe('costSnapshotBackfill', () => {
  it('fills missing snapshots for completed logs using category rate', () => {
    const db = new Database(':memory:')
    db.exec(`
      create table assets (
        id text primary key,
        category text,
        hourly_rate_cents integer not null default 0
      );
      create table asset_category_rates (
        category text primary key,
        hourly_rate_cents integer not null
      );
      create table usage_logs (
        id text primary key,
        chamber_id text not null,
        start_time text not null,
        end_time text,
        status text not null,
        hourly_rate_cents_snapshot integer,
        billable_hours_snapshot integer,
        cost_cents_snapshot integer,
        snapshot_at text,
        snapshot_source text
      );
    `)

    db.prepare('insert into assets (id,category,hourly_rate_cents) values (?,?,?)').run('c1', 'A', 999)
    db.prepare('insert into asset_category_rates (category,hourly_rate_cents) values (?,?)').run('A', 200)
    db.prepare(
      'insert into usage_logs (id,chamber_id,start_time,end_time,status,hourly_rate_cents_snapshot,billable_hours_snapshot,cost_cents_snapshot) values (?,?,?,?,?,?,?,?)'
    ).run('u1', 'c1', '2026-01-01T00:00:00.000Z', '2026-01-01T01:00:01.000Z', 'completed', null, null, null)

    const r = backfillUsageLogCostSnapshots(db as any, { limit: 100 })
    expect(r.updated).toBe(1)

    const row = db
      .prepare(
        'select hourly_rate_cents_snapshot as rate, billable_hours_snapshot as hours, cost_cents_snapshot as cost, snapshot_source as source from usage_logs where id = ?'
      )
      .get('u1') as any
    expect(row.rate).toBe(200)
    expect(row.hours).toBe(2)
    expect(row.cost).toBe(400)
    expect(row.source).toBe('backfill')
  })
})

