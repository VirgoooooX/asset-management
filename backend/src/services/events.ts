import type { Response } from 'express'

type AssetStatusChangedEvent = {
  type: 'asset_status_changed'
  assetId: string
  status: string
  updatedAt: string
}

type ServerEvent = AssetStatusChangedEvent

type Client = {
  id: string
  res: Response
}

const clients = new Map<string, Client>()
let heartbeat: NodeJS.Timeout | null = null

const startHeartbeatIfNeeded = () => {
  if (heartbeat) return
  heartbeat = setInterval(() => {
    if (!clients.size) return
    for (const c of clients.values()) {
      try {
        c.res.write(`: ping\n\n`)
      } catch {
        clients.delete(c.id)
      }
    }
    if (!clients.size && heartbeat) {
      clearInterval(heartbeat)
      heartbeat = null
    }
  }, 25_000)
}

const stopHeartbeatIfNeeded = () => {
  if (clients.size) return
  if (!heartbeat) return
  clearInterval(heartbeat)
  heartbeat = null
}

const writeEvent = (res: Response, eventName: string, data: unknown) => {
  res.write(`event: ${eventName}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export const addSseClient = (res: Response) => {
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
  clients.set(id, { id, res })
  startHeartbeatIfNeeded()
  writeEvent(res, 'ready', { ok: true })
  return id
}

export const removeSseClient = (id: string) => {
  clients.delete(id)
  stopHeartbeatIfNeeded()
}

export const publish = (evt: ServerEvent) => {
  if (!clients.size) return
  for (const c of clients.values()) {
    try {
      writeEvent(c.res, evt.type, evt)
    } catch {
      clients.delete(c.id)
    }
  }
  stopHeartbeatIfNeeded()
}

export const publishAssetStatusChanged = (assetId: string, status: string, updatedAt: string) => {
  publish({ type: 'asset_status_changed', assetId, status, updatedAt })
}
