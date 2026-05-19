import { config } from '../config.js'
import { getDb } from '../db/db.js'
import { sendPendingNotificationDeliveries } from './notificationDelivery.js'
import { scanNotificationConditions } from './notificationScanner.js'

let scannerTimer: NodeJS.Timeout | null = null
let running = false

export const runNotificationScanOnce = async () => {
  if (running) return { skipped: true }
  running = true
  try {
    const db = getDb()
    const scan = scanNotificationConditions(db)
    const deliveries = await sendPendingNotificationDeliveries(db)
    return { skipped: false, scan, deliveries }
  } finally {
    running = false
  }
}

export const startNotificationScanner = () => {
  if (scannerTimer) return
  const intervalMs = Math.max(60, config.notificationScanIntervalSeconds) * 1000
  scannerTimer = setInterval(() => {
    void runNotificationScanOnce().catch((e) => {
      console.error('[notifications] scan failed', e)
    })
  }, intervalMs)
  void runNotificationScanOnce().catch((e) => {
    console.error('[notifications] initial scan failed', e)
  })
}
