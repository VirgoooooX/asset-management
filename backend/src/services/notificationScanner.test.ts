import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { scanNotificationConditions } from './notificationScanner'

const createDb = () => {
  const db = new Database(':memory:')
  db.exec(`
    create table users (
      id text primary key,
      username text not null unique,
      email text,
      role text not null,
      status text not null
    );
    create table assets (
      id text primary key,
      type text not null,
      name text not null,
      status text not null,
      calibration_date text
    );
    create table usage_logs (
      id text primary key,
      chamber_id text not null,
      start_time text not null,
      end_time text,
      user text not null,
      status text not null,
      created_at text not null
    );
    create table notifications (
      id text primary key,
      type text not null,
      severity text not null,
      title text not null,
      message text not null,
      entity_type text not null,
      entity_id text not null,
      asset_id text,
      asset_name text,
      occurred_at text not null,
      url text,
      dedupe_key text,
      created_at text not null
    );
    create unique index idx_notifications_dedupe_key on notifications(dedupe_key) where dedupe_key is not null;
    create table notification_recipients (
      notification_id text not null,
      user_id text not null,
      created_at text not null,
      primary key (notification_id, user_id)
    );
    create table notification_deliveries (
      id text primary key,
      notification_id text not null,
      channel_type text not null,
      channel_id text,
      target text not null,
      status text not null,
      attempts integer not null,
      created_at text not null
    );
    create table notification_channels (
      id text primary key,
      type text not null,
      name text not null,
      webhook_url text not null,
      enabled integer not null,
      subscribed_types text,
      created_at text not null,
      updated_at text
    );
  `)
  return db
}

describe('notificationScanner', () => {
  it('creates daily-deduped calibration and overdue notifications', () => {
    const db = createDb()
    db.prepare('insert into users (id, username, email, role, status) values (?,?,?,?,?)').run(
      'manager-1',
      'manager',
      'manager@example.com',
      'manager',
      'active'
    )
    db.prepare('insert into assets (id, type, name, status, calibration_date) values (?,?,?,?,?)').run(
      'asset-1',
      'chamber',
      'TH01',
      'in-use',
      '2026-05-20T00:00:00.000Z'
    )
    db.prepare(
      'insert into usage_logs (id, chamber_id, start_time, end_time, user, status, created_at) values (?,?,?,?,?,?,?)'
    ).run(
      'log-1',
      'asset-1',
      '2026-05-17T00:00:00.000Z',
      '2026-05-18T00:00:00.000Z',
      'operator',
      'in-progress',
      '2026-05-17T00:00:00.000Z'
    )

    const first = scanNotificationConditions(db as any, {
      nowMs: Date.parse('2026-05-19T00:00:00.000Z'),
      calibrationDaysThreshold: 30,
      longOccupancyHoursThreshold: 72,
    })
    const second = scanNotificationConditions(db as any, {
      nowMs: Date.parse('2026-05-19T01:00:00.000Z'),
      calibrationDaysThreshold: 30,
      longOccupancyHoursThreshold: 72,
    })

    expect(first.created).toBe(2)
    expect(second.created).toBe(0)
    expect(
      db.prepare('select type from notifications order by type asc').all().map((r: any) => r.type)
    ).toEqual(['calibration_due', 'usage_overdue'])
  })
})
