import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { queryProjectCostGroups, queryProjectCostSeries, queryProjectCostLines, queryProjectCostReport } from './projectCostReport'

const setupDb = () => {
  const db = new Database(':memory:')
  db.exec(`
    create table assets (
      id text primary key,
      name text not null,
      category text,
      hourly_rate_cents integer not null default 0
    );
    create table asset_category_rates (
      category text primary key,
      hourly_rate_cents integer not null
    );
    create table projects (
      id text primary key,
      name text not null
    );
    create table usage_logs (
      id text primary key,
      chamber_id text not null,
      project_id text,
      start_time text not null,
      end_time text,
      user text not null,
      status text not null,
      notes text,
      hourly_rate_cents_snapshot integer
    );
  `)
  return db
}

describe('projectCostReport (db)', () => {
  it('groups by project and prefers hourly_rate_cents_snapshot', () => {
    const db = setupDb()
    db.prepare('insert into assets (id,name,category,hourly_rate_cents) values (?,?,?,?)').run('c1', 'C-01', 'A', 1200)
    db.prepare('insert into asset_category_rates (category,hourly_rate_cents) values (?,?)').run('A', 800)
    db.prepare('insert into projects (id,name) values (?,?)').run('p1', 'P-01')
    db.prepare('insert into projects (id,name) values (?,?)').run('p2', 'P-02')

    db.prepare(
      'insert into usage_logs (id,chamber_id,project_id,start_time,end_time,user,status,hourly_rate_cents_snapshot) values (?,?,?,?,?,?,?,?)'
    ).run('u1', 'c1', 'p1', '2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', 'alice', 'completed', 500)
    db.prepare(
      'insert into usage_logs (id,chamber_id,project_id,start_time,end_time,user,status,hourly_rate_cents_snapshot) values (?,?,?,?,?,?,?,?)'
    ).run('u2', 'c1', 'p2', '2026-01-01T00:00:00.000Z', '2026-01-01T02:00:00.000Z', 'bob', 'completed', null)

    const rangeStartMs = Date.parse('2026-01-01T00:00:00.000Z')
    const rangeEndMs = Date.parse('2026-01-02T00:00:00.000Z')
    const groups = queryProjectCostGroups(db, {
      groupBy: 'project',
      rangeStartMs,
      rangeEndMs,
      projectId: 'all',
      includeUnlinked: true,
      includeInProgress: false,
      nowMs: Date.parse('2026-01-01T12:00:00.000Z'),
      unlinkedLabel: 'Unlinked',
      uncategorizedLabel: 'Uncategorized',
    })

    expect(groups.find((g) => g.key === 'p1')?.hourlyRateCents).toBe(500)
    expect(groups.find((g) => g.key === 'p1')?.costCents).toBe(500)
    expect(groups.find((g) => g.key === 'p2')?.hourlyRateCents).toBe(800)
    expect(groups.find((g) => g.key === 'p2')?.costCents).toBe(1600)
  })

  it('series groups by UTC day and zero-fills missing days', () => {
    const db = setupDb()
    db.prepare('insert into assets (id,name,category,hourly_rate_cents) values (?,?,?,?)').run('c1', 'C-01', null, 100)
    db.prepare('insert into asset_category_rates (category,hourly_rate_cents) values (?,?)').run('', 100)
    db.prepare(
      'insert into usage_logs (id,chamber_id,project_id,start_time,end_time,user,status,hourly_rate_cents_snapshot) values (?,?,?,?,?,?,?,?)'
    ).run('u1', 'c1', null, '2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', 'alice', 'completed', 100)

    const series = queryProjectCostSeries(db, {
      rangeStartMs: Date.parse('2026-01-01T00:00:00.000Z'),
      rangeEndMs: Date.parse('2026-01-03T00:00:00.000Z'),
      projectId: 'all',
      includeUnlinked: true,
      includeInProgress: false,
      nowMs: Date.parse('2026-01-03T00:00:00.000Z'),
    })

    expect(series.map((s) => s.day)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(series[0].costCents).toBe(100)
    expect(series[1].costCents).toBe(0)
  })

  it('lines endpoint marks estimated when using in-progress end', () => {
    const db = setupDb()
    db.prepare('insert into assets (id,name,category,hourly_rate_cents) values (?,?,?,?)').run('c1', 'C-01', null, 100)
    db.prepare('insert into asset_category_rates (category,hourly_rate_cents) values (?,?)').run('', 100)
    db.prepare(
      'insert into usage_logs (id,chamber_id,project_id,start_time,end_time,user,status,hourly_rate_cents_snapshot) values (?,?,?,?,?,?,?,?)'
    ).run('u1', 'c1', 'p1', '2026-01-01T00:00:00.000Z', null, 'alice', 'in-progress', 100)

    const lines = queryProjectCostLines(db, {
      rangeStartMs: Date.parse('2026-01-01T00:00:00.000Z'),
      rangeEndMs: Date.parse('2026-01-01T05:00:00.000Z'),
      projectId: 'all',
      includeUnlinked: true,
      includeInProgress: true,
      nowMs: Date.parse('2026-01-01T03:00:00.000Z'),
      unlinkedLabel: 'Unlinked',
      uncategorizedLabel: 'Uncategorized',
    })

    expect(lines).toHaveLength(1)
    expect(lines[0].estimated).toBe(true)
    expect(lines[0].billableHours).toBe(3)
    expect(lines[0].costCents).toBe(300)
  })

  it('preserves millisecond precision when billing and returns combined report in queryProjectCostReport', () => {
    const db = setupDb()
    db.prepare('insert into assets (id,name,category,hourly_rate_cents) values (?,?,?,?)').run('c1', 'C-01', 'A', 100)
    db.prepare('insert into projects (id,name) values (?,?)').run('p1', 'P-01')
    db.prepare(
      'insert into usage_logs (id,chamber_id,project_id,start_time,end_time,user,status,hourly_rate_cents_snapshot) values (?,?,?,?,?,?,?,?)'
    ).run('u1', 'c1', 'p1', '2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.500Z', 'alice', 'completed', 100)

    const res = queryProjectCostReport(db, {
      groupBy: 'asset',
      rangeStartMs: Date.parse('2026-01-01T00:00:00.000Z'),
      rangeEndMs: Date.parse('2026-01-02T00:00:00.000Z'),
      projectId: 'all',
      includeUnlinked: true,
      includeInProgress: false,
      nowMs: Date.parse('2026-01-02T00:00:00.000Z'),
      unlinkedLabel: 'Unlinked',
      uncategorizedLabel: 'Uncategorized',
    })

    expect(res.groups).toHaveLength(1)
    expect(res.groups[0].billableHours).toBe(2)
    expect(res.groups[0].costCents).toBe(200)
    expect(res.series[0].costCents).toBe(200)
  })

  it('uses usage_logs start_time indexes in SQLite query planner', () => {
    const db = setupDb()
    db.exec(`
      create index idx_usage_logs_start_time on usage_logs(start_time);
      create index idx_usage_logs_project_start on usage_logs(project_id, start_time);
    `)
    const planAll = db
      .prepare(
        "explain query plan select u.id from usage_logs u where u.start_time < ? and ((u.end_time is not null and u.end_time > ?) or (u.end_time is null and ? = 1 and u.status in ('in-progress','overdue')))"
      )
      .all('2026-01-02T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0) as Array<{ detail: string }>
    expect(planAll.some((r) => r.detail.includes('idx_usage_logs_start_time'))).toBe(true)

    const planProj = db
      .prepare(
        "explain query plan select u.id from usage_logs u where u.start_time < ? and ((u.end_time is not null and u.end_time > ?) or (u.end_time is null and ? = 1 and u.status in ('in-progress','overdue'))) and u.project_id = ?"
      )
      .all('2026-01-02T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0, 'p1') as Array<{ detail: string }>
    expect(planProj.some((r) => r.detail.includes('idx_usage_logs_project_start'))).toBe(true)
  })
})
