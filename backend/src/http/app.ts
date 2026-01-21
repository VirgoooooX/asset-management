import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'
import { runMigrations } from '../db/migrate.js'
import { ensureAdminSeed } from '../services/adminSeed.js'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import { filesRouter } from './routes/files.js'
import { usageLogsRouter } from './routes/usageLogs.js'
import { adminRouter } from './routes/admin.js'
import { assetsRouter } from './routes/assets.js'
import { projectsRouter } from './routes/projects.js'
import { testProjectsRouter } from './routes/testProjects.js'
import { repairTicketsRouter } from './routes/repairTickets.js'
import { settingsRouter } from './routes/settings.js'
import { usersMeRouter } from './routes/usersMe.js'

export const createApp = async () => {
  fs.mkdirSync(config.dataDir, { recursive: true })
  fs.mkdirSync(config.filesDir, { recursive: true })
  const here = path.dirname(fileURLToPath(import.meta.url))
  const buildMigrationsDir = path.join(here, '..', 'db', 'migrations')
  const srcMigrationsDir = path.join(here, '..', '..', 'src', 'db', 'migrations')
  runMigrations(fs.existsSync(buildMigrationsDir) ? buildMigrationsDir : srcMigrationsDir)
  await ensureAdminSeed()

  const app = express()

  app.disable('x-powered-by')
  app.use(cookieParser())

  app.use(
    cors({
      origin: config.corsOrigin ?? true,
      credentials: true
    })
  )

  app.use(express.json({ limit: '1mb' }))

  app.use('/api/health', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/files', filesRouter)
  app.use('/api/usage-logs', usageLogsRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/assets', assetsRouter)
  app.use('/api/projects', projectsRouter)
  app.use('/api/test-projects', testProjectsRouter)
  app.use('/api/repair-tickets', repairTicketsRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/users/me', usersMeRouter)

  if (config.frontendDistDir) {
    const indexHtml = path.join(config.frontendDistDir, 'index.html')
    if (fs.existsSync(indexHtml)) {
      app.use(express.static(config.frontendDistDir))
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/')) return next()
        res.sendFile(indexHtml)
      })
    }
  }

  return app
}
