import express, { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../../config.js'
import { getDb } from '../../db/db.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireManager } from '../middlewares/requireManager.js'
import { asyncHandler } from '../middlewares/asyncHandler.js'
import { isSubPath, normalizeSlashPath } from '../../util/pathSafe.js'
import { getAssetFolderInfoById, resolveLegacyAssetFolderForRead } from '../../services/fileFolders.js'

export const filesRouter = Router()

const rawLimit = '30mb'
const rawBody = express.raw({ type: '*/*', limit: rawLimit })
const devLog = (event: string, payload: Record<string, unknown>) => {
  if (process.env.NODE_ENV === 'production') return
  console.log(`[files] ${event}`, payload)
}

const isSafeSegment = (segment: string) => {
  if (!segment) return false
  if (segment === '.' || segment === '..' || segment.startsWith('.')) return false
  if (segment.includes('..') || segment.includes('\0')) return false
  return true
}

const extractAssetId = (incoming: string) => {
  const p = normalizeSlashPath(incoming)
  const m = p.match(/^assets\/([^/]+)\/(.+)$/)
  if (!m) return null
  const assetId = m[1]
  const filename = path.posix.basename(m[2])
  if (!isSafeSegment(assetId) || !isSafeSegment(filename)) return null
  return { assetId, filename }
}

const resolveByAssetParam = (value: string) => {
  const p = normalizeSlashPath(value)
  if (!p.startsWith('by-asset/')) return null
  const parts = p.split('/').filter(Boolean)
  if (parts.length !== 3 || parts[0] !== 'by-asset') return null
  const [, assetId, filename] = parts
  if (!isSafeSegment(assetId) || !isSafeSegment(filename)) return null
  return { assetId, filename }
}

const resolveLegacyPathParam = (value: string) => {
  const p = normalizeSlashPath(value)
  const withoutPrefix = p.startsWith('files/') ? p.slice('files/'.length) : p
  const parts = withoutPrefix.split('/').filter(Boolean)
  if (parts.length < 3 || parts.some((seg) => !isSafeSegment(seg))) return null
  const categorySlug = parts[0]
  const assetFolder = parts[1]
  const filename = path.posix.basename(parts.slice(2).join('/'))
  if (!isSafeSegment(filename)) return null
  return { categorySlug, assetFolder, filename }
}

const DANGEROUS_INLINE_EXTS = new Set(['.svg', '.html', '.htm', '.xhtml', '.xml'])

const guessContentType = (filename: string) => {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (ext === '.xls') return 'application/vnd.ms-excel'
  if (ext === '.txt') return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

filesRouter.post(
  '/upload',
  requireAuth,
  requireManager,
  rawBody,
  asyncHandler(async (req, res) => {
    const incomingPath = typeof req.query.path === 'string' ? req.query.path : ''
    devLog('upload:start', {
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id,
      role: req.user?.role,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      limit: rawLimit,
    })

    const parsed = extractAssetId(incomingPath)
    if (!parsed) {
      devLog('upload:invalid_path', { incomingPath })
      return res.status(400).json({ error: 'invalid_path' })
    }

    const db = getDb()
    const assetExists = db.prepare('select 1 as ok from assets where id = ?').get(parsed.assetId) as { ok: 1 } | undefined
    if (!assetExists) {
      return res.status(404).json({ error: 'asset_not_found' })
    }

    const abs = path.join(config.filesDir, 'by-asset', parsed.assetId, parsed.filename)
    if (!isSubPath(config.filesDir, abs)) {
      devLog('upload:invalid_subpath', { filesDir: config.filesDir, abs })
      return res.status(400).json({ error: 'invalid_path' })
    }

    const buf = req.body instanceof Buffer ? req.body : Buffer.from([])
    if (!buf.length) {
      devLog('upload:empty_file', { incomingPath, assetId: parsed.assetId, filename: parsed.filename })
      return res.status(400).json({ error: 'empty_file' })
    }

    await fs.promises.mkdir(path.dirname(abs), { recursive: true })
    const tmp = `${abs}.tmp-${Date.now().toString(16)}`
    await fs.promises.writeFile(tmp, buf)
    await fs.promises.rename(tmp, abs)

    const canonicalPath = `by-asset/${parsed.assetId}/${parsed.filename}`
    const url = `/api/files/file?path=${encodeURIComponent(canonicalPath)}`
    devLog('upload:ok', {
      incomingPath,
      assetId: parsed.assetId,
      filename: parsed.filename,
      bytes: buf.length,
      canonicalPath,
      url,
    })
    res.json({ url, path: canonicalPath })
  })
)

filesRouter.get(
  '/file',
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const p = typeof req.query.path === 'string' ? req.query.path : ''
    const normalized = normalizeSlashPath(p)
    let abs: string | null = null
    let filename = ''

    const byAsset = resolveByAssetParam(p)
    if (byAsset) {
      filename = byAsset.filename
      abs = path.join(config.filesDir, 'by-asset', byAsset.assetId, byAsset.filename)
    } else if (!normalized.startsWith('by-asset/')) {
      const legacy = resolveLegacyPathParam(p)
      if (!legacy) {
        devLog('get:invalid_path', { p, method: req.method, url: req.originalUrl, userId: req.user?.id, role: req.user?.role })
        return res.status(400).json({ error: 'invalid_path' })
      }
      const resolvedFolder = await resolveLegacyAssetFolderForRead(legacy.categorySlug, legacy.assetFolder)
      if (!resolvedFolder) {
        devLog('get:not_found_folder', { p, ...legacy })
        return res.status(404).json({ error: 'not_found' })
      }
      filename = legacy.filename
      abs = path.join(config.filesDir, legacy.categorySlug, resolvedFolder, legacy.filename)
    }

    if (!abs || !isSubPath(config.filesDir, abs)) {
      devLog('get:invalid_subpath', { filesDir: config.filesDir, abs })
      return res.status(400).json({ error: 'invalid_path' })
    }

    try {
      await fs.promises.access(abs, fs.constants.R_OK)
    } catch {
      devLog('get:not_found_file', { abs })
      return res.status(404).json({ error: 'not_found' })
    }

    const ext = path.extname(filename).toLowerCase()
    const contentType = guessContentType(filename)
    devLog('get:ok', { abs, contentType })
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    if (DANGEROUS_INLINE_EXTS.has(ext)) {
      res.setHeader('Content-Security-Policy', 'sandbox')
      res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '_')}"`)
    }
    res.sendFile(abs, (err) => {
      if (err && !res.headersSent) next(err)
    })
  })
)

filesRouter.delete(
  '/delete',
  requireAuth,
  requireManager,
  asyncHandler(async (req, res) => {
    const p = typeof req.query.path === 'string' ? req.query.path : ''
    if (!p) return res.json({ ok: true })

    const normalized = normalizeSlashPath(p)
    const byAsset = resolveByAssetParam(normalized)
    if (byAsset) {
      const abs = path.join(config.filesDir, 'by-asset', byAsset.assetId, byAsset.filename)
      if (!isSubPath(config.filesDir, abs)) return res.status(400).json({ error: 'invalid_path' })
      await fs.promises.unlink(abs).catch(() => undefined)
      return res.json({ ok: true })
    }
    if (normalized.startsWith('by-asset/')) {
      return res.status(400).json({ error: 'invalid_path' })
    }

    if (normalized.startsWith('files/')) {
      const legacy = resolveLegacyPathParam(normalized)
      if (!legacy) return res.status(400).json({ error: 'invalid_path' })
      const resolvedFolder = await resolveLegacyAssetFolderForRead(legacy.categorySlug, legacy.assetFolder)
      if (!resolvedFolder) return res.json({ ok: true })
      const abs = path.join(config.filesDir, legacy.categorySlug, resolvedFolder, legacy.filename)
      if (isSubPath(config.filesDir, abs)) {
        await fs.promises.unlink(abs).catch(() => undefined)
      }
      return res.json({ ok: true })
    }

    const parsedOld = extractAssetId(p)
    if (!parsedOld) return res.status(400).json({ error: 'invalid_path' })

    const byAssetAbs = path.join(config.filesDir, 'by-asset', parsedOld.assetId, parsedOld.filename)
    if (!isSubPath(config.filesDir, byAssetAbs)) return res.status(400).json({ error: 'invalid_path' })
    await fs.promises.unlink(byAssetAbs).catch(() => undefined)

    const { categorySlug, preferredFolder } = getAssetFolderInfoById(parsedOld.assetId)
    const resolvedFolder = await resolveLegacyAssetFolderForRead(categorySlug, parsedOld.assetId)
    const legacyAbs = path.join(config.filesDir, categorySlug, resolvedFolder ?? preferredFolder, parsedOld.filename)
    if (isSubPath(config.filesDir, legacyAbs)) {
      await fs.promises.unlink(legacyAbs).catch(() => undefined)
    }
    return res.json({ ok: true })
  })
)
