import { Database } from 'better-sqlite3'
import { randomToken } from '../util/crypto.js'

export type NotificationType = 'usage_completed' | 'calibration_due' | 'usage_overdue' | 'usage_long'
export type NotificationSeverity = 'P1' | 'P2' | 'info'
export type NotificationChannelType = 'email' | 'wecom_bot' | 'feishu_bot'

export type NotificationInput = {
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message: string
  entityType: string
  entityId: string
  assetId?: string
  assetName?: string
  occurredAt: string
  url?: string
  dedupeKey?: string
}

export type NotificationRecord = NotificationInput & {
  id: string
  createdAt?: string
}

export type NotificationUser = {
  id: string
  username: string
  role: string
  email?: string
}

const normalizeEmail = (value: unknown) => {
  const s = typeof value === 'string' ? value.trim() : ''
  return s || undefined
}

export const createNotificationEvent = (
  db: Database,
  input: NotificationInput
): { id: string; created: boolean } => {
  if (input.dedupeKey) {
    const existing = db
      .prepare('select id from notifications where dedupe_key = ?')
      .get(input.dedupeKey) as { id: string } | undefined
    if (existing) return { id: existing.id, created: false }
  }

  const id = randomToken(16)
  const createdAt = new Date().toISOString()
  db.prepare(
    [
      'insert into notifications (',
      'id, type, severity, title, message, entity_type, entity_id, asset_id, asset_name, occurred_at, url, dedupe_key, created_at',
      ') values (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    ].join(' ')
  ).run(
    id,
    input.type,
    input.severity,
    input.title,
    input.message,
    input.entityType,
    input.entityId,
    input.assetId ?? null,
    input.assetName ?? null,
    input.occurredAt,
    input.url ?? null,
    input.dedupeKey ?? null,
    createdAt
  )
  return { id, created: true }
}

export const resolveNotificationUsers = (
  db: Database,
  args: { type: NotificationType; usageUser?: string }
): NotificationUser[] => {
  const rows = db
    .prepare(
      "select id, username, role, email from users where status = 'active' and (role in ('admin','manager') or username = ?) order by role asc, username asc"
    )
    .all(args.type === 'usage_completed' ? args.usageUser ?? '' : '') as any[]

  const byId = new Map<string, NotificationUser>()
  for (const row of rows) {
    if (row.role !== 'admin' && row.role !== 'manager' && args.type !== 'usage_completed') continue
    if (row.role !== 'admin' && row.role !== 'manager' && row.username !== args.usageUser) continue
    byId.set(row.id, {
      id: row.id,
      username: row.username,
      role: row.role,
      email: normalizeEmail(row.email),
    })
  }
  return Array.from(byId.values())
}

export const toNotificationRecord = (row: any): NotificationRecord => ({
  id: row.id,
  type: row.type,
  severity: row.severity,
  title: row.title,
  message: row.message,
  entityType: row.entity_type,
  entityId: row.entity_id,
  assetId: row.asset_id ?? undefined,
  assetName: row.asset_name ?? undefined,
  occurredAt: row.occurred_at,
  url: row.url ?? undefined,
  dedupeKey: row.dedupe_key ?? undefined,
  createdAt: row.created_at,
})

const formatLines = (n: NotificationRecord | NotificationInput) => [
  `**${n.title}**`,
  `> 级别: ${n.severity}`,
  n.assetName ? `> 设备: ${n.assetName}` : undefined,
  `> 类型: ${n.type}`,
  `> 时间: ${n.occurredAt}`,
  '',
  n.message,
  n.url ? `\n[打开详情](${n.url})` : undefined,
]

export const buildWecomBotPayload = (n: NotificationRecord | NotificationInput) => ({
  msgtype: 'markdown' as const,
  markdown: {
    content: formatLines(n).filter(Boolean).join('\n'),
  },
})

export const buildFeishuBotPayload = (n: NotificationRecord | NotificationInput) => ({
  msg_type: 'interactive' as const,
  card: {
    config: {
      wide_screen_mode: true,
    },
    header: {
      template: n.severity === 'P1' ? 'red' : n.severity === 'P2' ? 'orange' : 'blue',
      title: {
        tag: 'plain_text',
        content: n.title,
      },
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: formatLines(n).filter(Boolean).join('\n'),
        },
      },
    ],
  },
})

const parseSubscribedTypes = (value: unknown): NotificationType[] => {
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    const allowed = new Set<NotificationType>(['usage_completed', 'calibration_due', 'usage_overdue', 'usage_long'])
    return Array.isArray(parsed) ? parsed.filter((v): v is NotificationType => allowed.has(v)) : []
  } catch {
    return []
  }
}

const insertDelivery = (
  db: Database,
  args: {
    notificationId: string
    channelType: NotificationChannelType
    channelId?: string
    target: string
  }
) => {
  const id = randomToken(16)
  db.prepare(
    [
      'insert into notification_deliveries (',
      'id, notification_id, channel_type, channel_id, target, status, attempts, created_at',
      ') values (?,?,?,?,?,?,?,?)',
    ].join(' ')
  ).run(id, args.notificationId, args.channelType, args.channelId ?? null, args.target, 'pending', 0, new Date().toISOString())
  return id
}

export const enqueueNotificationDeliveries = (
  db: Database,
  args: { notificationId: string; type: NotificationType; users: NotificationUser[] }
) => {
  const now = new Date().toISOString()
  const recipientStmt = db.prepare(
    'insert or ignore into notification_recipients (notification_id, user_id, created_at) values (?, ?, ?)'
  )
  for (const user of args.users) {
    recipientStmt.run(args.notificationId, user.id, now)
    if (user.email) {
      insertDelivery(db, {
        notificationId: args.notificationId,
        channelType: 'email',
        target: user.email,
      })
    }
  }

  const channels = db
    .prepare(
      "select id, type, name, webhook_url, subscribed_types from notification_channels where enabled = 1 and type in ('wecom_bot','feishu_bot')"
    )
    .all() as any[]
  for (const channel of channels) {
    const subscribed = parseSubscribedTypes(channel.subscribed_types)
    if (subscribed.length > 0 && !subscribed.includes(args.type)) continue
    insertDelivery(db, {
      notificationId: args.notificationId,
      channelType: channel.type,
      channelId: channel.id,
      target: channel.webhook_url,
    })
  }
}

export const createNotificationWithDeliveries = (
  db: Database,
  input: NotificationInput,
  args: { users: NotificationUser[] }
) => {
  const result = createNotificationEvent(db, input)
  if (result.created) {
    enqueueNotificationDeliveries(db, { notificationId: result.id, type: input.type, users: args.users })
  }
  return result
}
