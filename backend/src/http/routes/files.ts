import express, { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../../config.js'
import { getDb } from '../../db/db.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireAdmin } from '../middlewares/requireAdmin.js'
import { isSubPath, normalizeSlashPath } from '../../util/pathSafe.js'
import { ensureAssetFolder, getAssetFolderInfoById, resolveAssetFolderForRead } from '../../services/fileFolders.js'

export const filesRouter = Router()

const rawLimit = '30mb'
const rawBody = express.raw({ type: '*/*', limit: rawLimit })

const extractAssetId = (incoming: string) => {
  const p = normalizeSlashPath(incoming)
  const m = p.match(/^assets\/([^/]+)\/(.+)$/)
  if (!m) return null
  const assetId = m[1]
  const filename = path.posix.basename(m[2])
  if (!assetId || !filename) return null
  if (assetId.includes('..') || filename.includes('..')) return null
  return { assetId, filename }
}

const toCanonicalPath = (categorySlug: string, folderOrAssetId: string, filename: string) => {
  const seg = [categorySlug, folderOrAssetId, filename].map((v) => normalizeSlashPath(v))
  return `files/${seg.join('/')}`
}

const toAbsoluteFilePath = (categorySlug: string, assetFolder: string, filename: string) => {
  return path.join(config.filesDir, categorySlug, assetFolder, filename)
}

const resolvePathParam = (value: string) => {
  const p = normalizeSlashPath(value)
  const withoutPrefix = p.startsWith('files/') ? p.slice('files/'.length) : p
  const parts = withoutPrefix.split('/').filter(Boolean)
  if (parts.length < 3) return null
  const categorySlug = parts[0]
  const assetFolder = parts[1]
  const filename = parts.slice(2).join('/')
  if (!categorySlug || !assetFolder || !filename) return null
  if (categorySlug.includes('..') || assetFolder.includes('..') || filename.includes('..')) return null
  return { categorySlug, assetFolder, filename: path.posix.basename(filename) }
}

const guessContentType = (filename: string) => {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (ext === '.xls') return 'application/vnd.ms-excel'
  if (ext === '.txt') return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

filesRouter.post(
  '/upload',
  requireAuth,
  requireAdmin,
  rawBody,
  async (req, res) => {
    const incomingPath = typeof req.query.path === 'string' ? req.query.path : ''
    const parsed = extractAssetId(incomingPath)
    if (!parsed) return res.status(400).json({ error: 'invalid_path' })

    const { categorySlug, preferredFolder } = getAssetFolderInfoById(parsed.assetId)
    const assetFolder = await ensureAssetFolder(categorySlug, preferredFolder, parsed.assetId)
    const abs = toAbsoluteFilePath(categorySlug, assetFolder, parsed.filename)
    if (!isSubPath(config.filesDir, abs)) return res.status(400).json({ error: 'invalid_path' })

    const dir = path.dirname(abs)
    await fs.promises.mkdir(dir, { recursive: true })

    const buf = req.body instanceof Buffer ? req.body : Buffer.from([])
    if (!buf.length) return res.status(400).json({ error: 'empty_file' })

    const tmp = abs + '.tmp-' + Date.now().toString(16)
    await fs.promises.writeFile(tmp, buf)
    await fs.promises.rename(tmp, abs)

    const canonicalPath = toCanonicalPath(categorySlug, parsed.assetId, parsed.filename)
    const baseUrl = `${req.protocol}://${req.get('host')}`
    const url = `${baseUrl}/api/files/file?path=${encodeURIComponent(canonicalPath)}`
    res.json({ url, path: canonicalPath })
  }
)

filesRouter.get('/file', requireAuth, async (req, res) => {
  const p = typeof req.query.path === 'string' ? req.query.path : ''
  const parsed = resolvePathParam(p)
  if (!parsed) return res.status(400).json({ error: 'invalid_path' })

  const resolvedFolder = await resolveAssetFolderForRead(parsed.categorySlug, parsed.assetFolder)
  if (!resolvedFolder) return res.status(404).json({ error: 'not_found' })

  const abs = toAbsoluteFilePath(parsed.categorySlug, resolvedFolder, parsed.filename)
  if (!isSubPath(config.filesDir, abs)) return res.status(400).json({ error: 'invalid_path' })

  try {
    await fs.promises.access(abs, fs.constants.R_OK)
  } catch {
    return res.status(404).json({ error: 'not_found' })
  }

  res.setHeader('content-type', guessContentType(parsed.filename))
  res.setHeader('cache-control', 'private, max-age=3600')
  fs.createReadStream(abs).pipe(res)
})

filesRouter.delete('/delete', requireAuth, requireAdmin, async (req, res) => {
  const p = typeof req.query.path === 'string' ? req.query.path : ''
  if (!p) return res.json({ ok: true })

  const parsedNew = resolvePathParam(p)
  if (parsedNew) {
    const resolvedFolder = await resolveAssetFolderForRead(parsedNew.categorySlug, parsedNew.assetFolder)
    if (!resolvedFolder) return res.json({ ok: true })
    const abs = toAbsoluteFilePath(parsedNew.categorySlug, resolvedFolder, parsedNew.filename)
    if (isSubPath(config.filesDir, abs)) {
      await fs.promises.unlink(abs).catch(() => undefined)
    }
    return res.json({ ok: true })
  }

  const parsedOld = extractAssetId(p)
  if (!parsedOld) return res.status(400).json({ error: 'invalid_path' })
  const { categorySlug, preferredFolder } = getAssetFolderInfoById(parsedOld.assetId)
  const resolvedFolder = await resolveAssetFolderForRead(categorySlug, parsedOld.assetId)
  const abs = toAbsoluteFilePath(categorySlug, resolvedFolder ?? preferredFolder, parsedOld.filename)
  if (!isSubPath(config.filesDir, abs)) return res.status(400).json({ error: 'invalid_path' })
  await fs.promises.unlink(abs).catch(() => undefined)
  return res.json({ ok: true })
})
