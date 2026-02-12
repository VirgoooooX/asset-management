import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { writeAuditLog } from './auditLog'

describe('auditLog', () => {
  it('writes request context when provided', () => {
    const db = new Database(':memory:')
    db.exec(`
      create table audit_logs (
        id text primary key,
        at text not null,
        actor_user_id text not null,
        actor_username text not null,
        action text not null,
        entity_type text not null,
        entity_id text not null,
        before_json text,
        after_json text,
        ip text,
        user_agent text,
        request_id text
      );
    `)

    writeAuditLog(db as any, {
      actor: { id: 'u1', username: 'alice' },
      action: 'asset.update',
      entityType: 'asset',
      entityId: 'a1',
      before: { x: 1 },
      after: { x: 2 },
      ip: '127.0.0.1',
      userAgent: 'ua',
      requestId: 'r1',
    } as any)

    const row = db.prepare('select ip, user_agent, request_id from audit_logs').get() as any
    expect(row.ip).toBe('127.0.0.1')
    expect(row.user_agent).toBe('ua')
    expect(row.request_id).toBe('r1')
  })
})

