import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import {
  buildFeishuBotPayload,
  buildWecomBotPayload,
  createNotificationEvent,
  resolveNotificationUsers,
} from './notificationService'

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
  `)
  return db
}

describe('notificationService', () => {
  it('deduplicates notification events by dedupe key', () => {
    const db = createDb()
    const input = {
      type: 'usage_overdue' as const,
      severity: 'P1' as const,
      title: '使用记录已逾期',
      message: 'TH01 已超过结束时间',
      entityType: 'usage_log',
      entityId: 'log-1',
      assetId: 'asset-1',
      assetName: 'TH01',
      occurredAt: '2026-05-19T00:00:00.000Z',
      url: '/alerts',
      dedupeKey: 'usage_overdue:log-1:2026-05-19',
    }

    const first = createNotificationEvent(db as any, input)
    const second = createNotificationEvent(db as any, input)

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.id).toBe(first.id)
    expect(db.prepare('select count(1) as count from notifications').get()).toEqual({ count: 1 })
  })

  it('resolves usage completion recipients to the matching user plus managers and admins', () => {
    const db = createDb()
    db.prepare('insert into users (id, username, email, role, status) values (?,?,?,?,?)').run(
      'u1',
      'operator',
      'operator@example.com',
      'user',
      'active'
    )
    db.prepare('insert into users (id, username, email, role, status) values (?,?,?,?,?)').run(
      'u2',
      'manager',
      'manager@example.com',
      'manager',
      'active'
    )
    db.prepare('insert into users (id, username, email, role, status) values (?,?,?,?,?)').run(
      'u3',
      'admin',
      'admin@example.com',
      'admin',
      'active'
    )
    db.prepare('insert into users (id, username, email, role, status) values (?,?,?,?,?)').run(
      'u4',
      'disabled-manager',
      'disabled@example.com',
      'manager',
      'disabled'
    )

    const users = resolveNotificationUsers(db as any, {
      type: 'usage_completed',
      usageUser: 'operator',
    })

    expect(users.map((u) => u.id).sort()).toEqual(['u1', 'u2', 'u3'])
  })

  it('formats enterprise bot payloads with the notification context', () => {
    const notification = {
      id: 'n1',
      type: 'calibration_due' as const,
      severity: 'P2' as const,
      title: '校准即将到期',
      message: 'TH01 将在 7 天内到期',
      entityType: 'asset',
      entityId: 'asset-1',
      assetId: 'asset-1',
      assetName: 'TH01',
      occurredAt: '2026-05-19T00:00:00.000Z',
      url: '/calibrations',
    }

    const wecom = buildWecomBotPayload(notification)
    const feishu = buildFeishuBotPayload(notification)

    expect(wecom.msgtype).toBe('markdown')
    expect(wecom.markdown.content).toContain('校准即将到期')
    expect(wecom.markdown.content).toContain('TH01')
    expect(feishu.msg_type).toBe('interactive')
    expect(JSON.stringify(feishu)).toContain('校准即将到期')
    expect(JSON.stringify(feishu)).toContain('TH01')
  })
})
