import type Database from 'better-sqlite3'
import type { Request } from 'express'
import { randomToken } from '../util/crypto.js'

export type AuditLogEntry = {
  at?: string
  actor: { id: string; username: string }
  action: string
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
  ip?: string
  userAgent?: string
  requestId?: string
}

const safeJson = (value: unknown): string | null => {
  if (value === undefined) return null
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

export const writeAuditLog = (db: Database.Database, entry: AuditLogEntry) => {
  const id = randomToken(16)
  const at = entry.at ?? new Date().toISOString()
  const beforeJson = safeJson(entry.before)
  const afterJson = safeJson(entry.after)
  db.prepare(
    'insert into audit_logs (id, at, actor_user_id, actor_username, action, entity_type, entity_id, before_json, after_json, ip, user_agent, request_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    at,
    entry.actor.id,
    entry.actor.username,
    entry.action,
    entry.entityType,
    entry.entityId,
    beforeJson,
    afterJson,
    entry.ip ?? null,
    entry.userAgent ?? null,
    entry.requestId ?? null
  )
}

export const writeAuditFromReq = (
  db: Database.Database,
  req: Request,
  entry: Omit<AuditLogEntry, 'actor' | 'ip' | 'userAgent' | 'requestId'>
) => {
  if (!req.user) return
  writeAuditLog(db, {
    ...entry,
    actor: req.user,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    requestId: req.requestId,
  })
}
