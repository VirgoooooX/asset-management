import { Database } from 'better-sqlite3'
import { config } from '../config.js'
import {
  NotificationRecord,
  buildFeishuBotPayload,
  buildWecomBotPayload,
  toNotificationRecord,
} from './notificationService.js'

type DeliveryRow = {
  id: string
  notification_id: string
  channel_type: 'email' | 'wecom_bot' | 'feishu_bot'
  target: string
  attempts: number
}

const markDelivery = (
  db: Database,
  id: string,
  status: 'sent' | 'failed' | 'skipped',
  error?: string
) => {
  const now = new Date().toISOString()
  db.prepare(
    'update notification_deliveries set status = ?, attempts = attempts + 1, last_error = ?, sent_at = ?, updated_at = ? where id = ?'
  ).run(status, error ?? null, status === 'sent' ? now : null, now, id)
}

const emailConfigured = () =>
  config.email.enabled &&
  Boolean(config.email.host) &&
  Boolean(config.email.from)

const sendEmail = async (target: string, notification: NotificationRecord) => {
  if (!emailConfigured()) return { skipped: true, error: 'email_not_configured' }
  const importer = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>
  const mod = await importer('nodemailer')
  const nodemailer = mod.default ?? mod
  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: config.email.user
      ? {
          user: config.email.user,
          pass: config.email.password,
        }
      : undefined,
  })
  await transporter.sendMail({
    from: config.email.from,
    to: target,
    subject: `[Chamber Tracker] ${notification.title}`,
    text: [
      notification.title,
      '',
      notification.message,
      '',
      notification.assetName ? `设备: ${notification.assetName}` : undefined,
      `类型: ${notification.type}`,
      `级别: ${notification.severity}`,
      `时间: ${notification.occurredAt}`,
      notification.url ? `链接: ${notification.url}` : undefined,
    ]
      .filter(Boolean)
      .join('\n'),
  })
  return { skipped: false }
}

const postJson = async (url: string, payload: unknown) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
}

export const sendPendingNotificationDeliveries = async (db: Database, limit = 25) => {
  const rows = db
    .prepare(
      "select id, notification_id, channel_type, target, attempts from notification_deliveries where status = 'pending' order by created_at asc limit ?"
    )
    .all(limit) as DeliveryRow[]

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const row of rows) {
    const notificationRow = db.prepare('select * from notifications where id = ?').get(row.notification_id) as any | undefined
    if (!notificationRow) {
      markDelivery(db, row.id, 'skipped', 'notification_not_found')
      skipped++
      continue
    }
    const notification = toNotificationRecord(notificationRow)
    try {
      if (row.channel_type === 'email') {
        const result = await sendEmail(row.target, notification)
        if (result.skipped) {
          markDelivery(db, row.id, 'skipped', result.error)
          skipped++
        } else {
          markDelivery(db, row.id, 'sent')
          sent++
        }
      } else if (row.channel_type === 'wecom_bot') {
        await postJson(row.target, buildWecomBotPayload(notification))
        markDelivery(db, row.id, 'sent')
        sent++
      } else if (row.channel_type === 'feishu_bot') {
        await postJson(row.target, buildFeishuBotPayload(notification))
        markDelivery(db, row.id, 'sent')
        sent++
      }
    } catch (e: any) {
      markDelivery(db, row.id, 'failed', e?.message || 'send_failed')
      failed++
    }
  }

  return { scanned: rows.length, sent, failed, skipped }
}
