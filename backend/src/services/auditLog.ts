import { randomToken } from '../util/crypto.js'

export type AuditLogEntry = {
  at?: string
  actor: { id: string; username: string }
  action: string
  entityType: string
  entityId: string
  before?: any
  after?: any
  ip?: string
  userAgent?: string
  requestId?: string
}

const safeJson = (value: any): string | null => {
  if (value === undefined) return null
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

export const writeAuditLog = (db: any, entry: AuditLogEntry) => {
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
