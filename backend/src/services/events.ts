import type { Response } from 'express'

type AssetStatusChangedEvent = {
  type: 'asset_status_changed'
  assetId: string
  status: string
  updatedAt: string
}

type AssetUpdatedEvent = {
  type: 'asset_updated'
  assetId: string
  updatedAt: string
}

type RepairTicketChangedEvent = {
  type: 'repair_ticket_changed'
  ticketId: string
  assetId: string
  updatedAt: string
}

type UsageLogChangedEvent = {
  type: 'usage_log_changed'
  logId: string
  chamberId: string
  updatedAt: string
}

type ServerEvent = AssetStatusChangedEvent | AssetUpdatedEvent | RepairTicketChangedEvent | UsageLogChangedEvent

type Client = {
  id: string
  res: Response
}

const MAX_SSE_BUFFER_BYTES = 1024 * 1024
const clients = new Map<string, Client>()
let heartbeat: NodeJS.Timeout | null = null

const isClientWritable = (res: Response) => {
  if (res.writableEnded || res.destroyed) return false
  if (res.writableLength > MAX_SSE_BUFFER_BYTES) return false
  return true
}

const stopHeartbeatIfNeeded = () => {
  if (clients.size) return
  if (!heartbeat) return
  clearInterval(heartbeat)
  heartbeat = null
}

const startHeartbeatIfNeeded = () => {
  if (heartbeat) return
  heartbeat = setInterval(() => {
    if (!clients.size) {
      stopHeartbeatIfNeeded()
      return
    }
    for (const c of clients.values()) {
      if (!isClientWritable(c.res)) {
        clients.delete(c.id)
        continue
      }
      try {
        c.res.write(`: ping\n\n`)
      } catch {
        clients.delete(c.id)
      }
    }
    stopHeartbeatIfNeeded()
  }, 25_000)
  heartbeat.unref()
}

const formatSseFrame = (eventName: string, data: unknown) => `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`

export const addSseClient = (res: Response) => {
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
  clients.set(id, { id, res })
  res.on('error', () => removeSseClient(id))
  res.on('close', () => removeSseClient(id))
  startHeartbeatIfNeeded()
  try {
    res.write(formatSseFrame('ready', { ok: true }))
  } catch {
    removeSseClient(id)
  }
  return id
}

export const removeSseClient = (id: string) => {
  clients.delete(id)
  stopHeartbeatIfNeeded()
}

export const closeAllSseClients = () => {
  for (const c of clients.values()) {
    try {
      c.res.end()
    } catch {
      // ignore socket errors during shutdown
    }
  }
  clients.clear()
  stopHeartbeatIfNeeded()
}

export const publish = (evt: ServerEvent) => {
  if (!clients.size) return
  const payload = formatSseFrame(evt.type, evt)
  for (const c of clients.values()) {
    if (!isClientWritable(c.res)) {
      clients.delete(c.id)
      continue
    }
    try {
      c.res.write(payload)
    } catch {
      clients.delete(c.id)
    }
  }
  stopHeartbeatIfNeeded()
}

export const publishAssetStatusChanged = (assetId: string, status: string, updatedAt: string) => {
  publish({ type: 'asset_status_changed', assetId, status, updatedAt })
}

export const publishAssetUpdated = (assetId: string, updatedAt: string) => {
  publish({ type: 'asset_updated', assetId, updatedAt })
}

export const publishRepairTicketChanged = (ticketId: string, assetId: string, updatedAt: string) => {
  publish({ type: 'repair_ticket_changed', ticketId, assetId, updatedAt })
}

export const publishUsageLogChanged = (logId: string, chamberId: string, updatedAt: string) => {
  publish({ type: 'usage_log_changed', logId, chamberId, updatedAt })
}
