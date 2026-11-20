import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { buildPatchSet, getEffectiveAssetRateCents, writeUsageLogCostSnapshot } from './sqlHelpers'

const setupSchema = (db: Database.Database) => {
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
}

describe('sqlHelpers', () => {
  it('buildPatchSet skips undefined, applies nullable/nullFallback, serializes JSON, and appends extra fields', () => {
    const specs = {
      name: { column: 'name' },
      notes: { column: 'notes', nullable: true },
      tags: { column: 'tags', json: true, nullable: true },
      configs: { column: 'configs', json: true, nullFallback: [] },
      ignored: { column: 'ignored' },
    }
    const { sets, params } = buildPatchSet(
      {
        name: 'Chamber-1',
        notes: null,
        tags: ['fast', 'thermal'],
        configs: null,
        ignored: undefined,
      },
      specs,
      [{ column: 'updated_at', value: '2026-01-02T00:00:00.000Z' }]
    )

    expect(sets).toEqual([
      'name = ?',
      'notes = ?',
      'tags = ?',
      'configs = ?',
      'updated_at = ?',
    ])
    expect(params).toEqual([
      'Chamber-1',
      null,
      '["fast","thermal"]',
      '[]',
      '2026-01-02T00:00:00.000Z',
    ])
  })

  it('getEffectiveAssetRateCents resolves category rate override, asset fallback, blank category, and zero fallback', () => {
    const db = new Database(':memory:')
    setupSchema(db)

    db.prepare('insert into assets (id, category, hourly_rate_cents) values (?, ?, ?)').run('a1', '  Thermal  ', 500)
    db.prepare('insert into assets (id, category, hourly_rate_cents) values (?, ?, ?)').run('a2', 'Humidity', 750)
    db.prepare('insert into assets (id, category, hourly_rate_cents) values (?, ?, ?)').run('a3', '   ', 0)
    db.prepare('insert into asset_category_rates (category, hourly_rate_cents) values (?, ?)').run('Thermal', 1200)
    db.prepare('insert into asset_category_rates (category, hourly_rate_cents) values (?, ?)').run('', 300)

    expect(getEffectiveAssetRateCents(db, 'a1')).toBe(1200)
    expect(getEffectiveAssetRateCents(db, 'a2')).toBe(750)
    expect(getEffectiveAssetRateCents(db, 'a3')).toBe(300)
    expect(getEffectiveAssetRateCents(db, 'missing')).toBe(0)
    db.close()
  })

  it('writeUsageLogCostSnapshot writes snapshots only when completed with end_time and skips no-op updates', () => {
    const db = new Database(':memory:')
    setupSchema(db)

    db.prepare('insert into assets (id, category, hourly_rate_cents) values (?, ?, ?)').run('a1', 'Cat', 1000)
    db.prepare(
      'insert into usage_logs (id, chamber_id, start_time, end_time, status) values (?, ?, ?, ?, ?)'
    ).run('u-active', 'a1', '2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', 'in-progress')
    db.prepare(
      'insert into usage_logs (id, chamber_id, start_time, end_time, status) values (?, ?, ?, ?, ?)'
    ).run('u-no-end', 'a1', '2026-01-01T00:00:00.000Z', null, 'completed')
    db.prepare(
      'insert into usage_logs (id, chamber_id, start_time, end_time, status) values (?, ?, ?, ?, ?)'
    ).run('u-done', 'a1', '2026-01-01T00:00:00.000Z', '2026-01-01T01:30:00.000Z', 'completed')

    expect(writeUsageLogCostSnapshot(db, 'u-active', 'at_completion').updated).toBe(false)
    expect(writeUsageLogCostSnapshot(db, 'u-no-end', 'at_completion').updated).toBe(false)

    const first = writeUsageLogCostSnapshot(db, 'u-done', 'at_completion')
    expect(first.updated).toBe(true)
    if (first.updated) {
      expect(first.next).toEqual({
        hourlyRateCentsSnapshot: 1000,
        billableHoursSnapshot: 2,
        costCentsSnapshot: 2000,
      })
    }

    const second = writeUsageLogCostSnapshot(db, 'u-done', 'recompute')
    expect(second.updated).toBe(false)
    db.close()
  })
})
