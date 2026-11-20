import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import compression from 'compression'
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
import { usersMeRouter } from './routes/usersMe.js'
import { eventsRouter } from './routes/events.js'
import { notificationsRouter } from './routes/notifications.js'
import { reportsRouter } from './routes/reports.js'
import { attachRequestId } from './middlewares/requestId.js'
import { apiNotFoundHandler, errorHandler } from './middlewares/errorHandler.js'

const resolveCorsOrigin = (): string[] | false => {
  if (config.corsOrigin) {
    const allowed = config.corsOrigin
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return allowed.length ? allowed : false
  }
  return process.env.NODE_ENV === 'production'
    ? false
    : ['http://localhost:3000', 'http://127.0.0.1:3000']
}

export const createApp = async () => {
  fs.mkdirSync(config.dataDir, { recursive: true })
  fs.mkdirSync(config.filesDir, { recursive: true })
  const here = path.dirname(fileURLToPath(import.meta.url))
  const buildMigrationsDir = path.join(here, '..', 'db', 'migrations')
  const srcMigrationsDir = path.join(here, '..', '..', 'src', 'db', 'migrations')
  runMigrations(fs.existsSync(buildMigrationsDir) ? buildMigrationsDir : srcMigrationsDir)
  await ensureAdminSeed()

  const app = express()

  if (config.trustProxy !== undefined) {
    app.set('trust proxy', config.trustProxy)
  }

  app.disable('x-powered-by')
  app.use(attachRequestId)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })
  app.use(cookieParser())

  app.use(
    compression({
      filter: (req, res) => {
        if (req.path === '/api/events') return false
        const accept = req.headers.accept || ''
        if (accept.includes('text/event-stream')) return false
        return compression.filter(req, res)
      },
    })
  )

  app.use(
    cors({
      origin: resolveCorsOrigin(),
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
  app.use('/api/users/me', usersMeRouter)
  app.use('/api/events', eventsRouter)
  app.use('/api/notifications', notificationsRouter)
  app.use('/api/reports', reportsRouter)
  app.use('/api', apiNotFoundHandler)

  if (config.frontendDistDir) {
    const indexHtml = path.join(config.frontendDistDir, 'index.html')
    if (fs.existsSync(indexHtml)) {
      const assetsDir = path.join(config.frontendDistDir, 'assets')
      if (fs.existsSync(assetsDir)) {
        app.use('/assets', express.static(assetsDir, { maxAge: '1y', immutable: true }))
      }
      app.use(
        express.static(config.frontendDistDir, {
          maxAge: 0,
          setHeaders: (res, filePath) => {
            if (filePath.endsWith('index.html')) {
              res.setHeader('Cache-Control', 'no-cache')
            }
          },
        })
      )
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/')) return next()
        res.setHeader('Cache-Control', 'no-cache')
        res.sendFile(indexHtml)
      })
    }
  }

  app.use(errorHandler)

  return app
}
