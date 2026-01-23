import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { addSseClient, removeSseClient } from '../../services/events.js'

export const eventsRouter = Router()

eventsRouter.get('/', requireAuth, (req, res) => {
  res.status(200)
  res.setHeader('content-type', 'text/event-stream')
  res.setHeader('cache-control', 'no-cache')
  res.setHeader('connection', 'keep-alive')
  res.setHeader('x-accel-buffering', 'no')
  res.flushHeaders?.()

  res.write(`retry: 3000\n\n`)
  const id = addSseClient(res)
  req.on('close', () => {
    removeSseClient(id)
  })
})
