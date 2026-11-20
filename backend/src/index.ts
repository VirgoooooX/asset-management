import { config } from './config.js'
import { closeDb } from './db/db.js'
import { createApp } from './http/app.js'
import { closeAllSseClients } from './services/events.js'

const app = await createApp()

const server = app.listen(config.port, () => {
  process.stdout.write(`api listening on :${config.port}\n`)
})

let shuttingDown = false
const shutdown = (signal: string) => {
  if (shuttingDown) return
  shuttingDown = true
  process.stdout.write(`received ${signal}, shutting down...\n`)
  closeAllSseClients()
  const forceTimer = setTimeout(() => {
    closeDb()
    process.exit(1)
  }, 5000)
  forceTimer.unref()

  server.close(() => {
    closeDb()
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
