import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import { getDb } from '../db/db.js'
import { slugifyAssetFolder, slugifyCategory } from '../util/slug.js'

const markerName = '.asset-id'

export const getAssetFolderInfoById = (assetId: string) => {
  const db = getDb()
  const row = db.prepare('select category, name from assets where id = ?').get(assetId) as
    | { category?: string; name?: string }
    | undefined
  const category = typeof row?.category === 'string' ? row.category : ''
  const name = typeof row?.name === 'string' ? row.name : ''
  const categorySlug = slugifyCategory(category)
  const preferredFolder = slugifyAssetFolder(name)
  return { categorySlug, preferredFolder }
}

const folderDir = (categorySlug: string, folder: string) => path.join(config.filesDir, categorySlug, folder)

const markerPath = (categorySlug: string, folder: string) => path.join(config.filesDir, categorySlug, folder, markerName)

const readMarker = async (categorySlug: string, folder: string) => {
  try {
    const content = await fs.promises.readFile(markerPath(categorySlug, folder), 'utf8')
    return content.trim()
  } catch {
    return null
  }
}

const pathExists = async (p: string) => {
  try {
    await fs.promises.access(p, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

const writeMarkerIfMissing = async (categorySlug: string, folder: string, assetId: string) => {
  const p = markerPath(categorySlug, folder)
  try {
    await fs.promises.access(p, fs.constants.F_OK)
    return
  } catch {
    await fs.promises.writeFile(p, assetId, 'utf8')
  }
}

export const ensureAssetFolder = async (categorySlug: string, preferredFolder: string, assetId: string) => {
  const base = preferredFolder
  for (let i = 0; i < 1000; i++) {
    const folder = i === 0 ? base : `${base} (${i + 1})`
    const dir = folderDir(categorySlug, folder)
    await fs.promises.mkdir(dir, { recursive: true })
    const marker = await readMarker(categorySlug, folder)
    if (!marker || marker === assetId) {
      await writeMarkerIfMissing(categorySlug, folder, assetId)
      return folder
    }
  }
  throw new Error('unable_to_allocate_asset_folder')
}

const findFolderByMarker = async (categorySlug: string, assetId: string) => {
  const categoryDir = path.join(config.filesDir, categorySlug)
  let entries: fs.Dirent[] = []
  try {
    entries = await fs.promises.readdir(categoryDir, { withFileTypes: true })
  } catch {
    return null
  }

  for (const e of entries) {
    if (!e.isDirectory()) continue
    const marker = await readMarker(categorySlug, e.name)
    if (marker === assetId) return e.name
  }
  return null
}

const moveFolderContents = async (fromDir: string, toDir: string) => {
  await fs.promises.mkdir(toDir, { recursive: true })
  const entries = await fs.promises.readdir(fromDir, { withFileTypes: true })

  for (const e of entries) {
    if (e.name === markerName) continue
    const src = path.join(fromDir, e.name)
    let dest = path.join(toDir, e.name)
    if (await pathExists(dest)) {
      const ext = path.extname(e.name)
      const base = ext ? e.name.slice(0, -ext.length) : e.name
      for (let i = 0; i < 1000; i++) {
        const candidate = `${base} (${i + 2})${ext}`
        const candidatePath = path.join(toDir, candidate)
        if (!(await pathExists(candidatePath))) {
          dest = candidatePath
          break
        }
      }
    }
    await fs.promises.rename(src, dest)
  }

  const marker = path.join(fromDir, markerName)
  await fs.promises.unlink(marker).catch(() => undefined)
  await fs.promises.rmdir(fromDir).catch(() => undefined)
}

export const syncAssetFolderToPreferred = async (assetId: string, fromCategorySlug?: string) => {
  const db = getDb()
  const row = db.prepare('select id, category, name from assets where id = ?').get(assetId) as
    | { id?: string; category?: string; name?: string }
    | undefined
  const id = typeof row?.id === 'string' ? row.id : ''
  if (!id) return null

  const category = typeof row?.category === 'string' ? row.category : ''
  const name = typeof row?.name === 'string' ? row.name : ''
  const nextCategorySlug = slugifyCategory(category)
  const preferredFolder = slugifyAssetFolder(name)

  const targetFolder = await ensureAssetFolder(nextCategorySlug, preferredFolder, id)

  const candidates: Array<{ categorySlug: string; folder: string }> = []
  if (fromCategorySlug) {
    const byMarker = await findFolderByMarker(fromCategorySlug, id)
    if (byMarker) candidates.push({ categorySlug: fromCategorySlug, folder: byMarker })
    if (await pathExists(folderDir(fromCategorySlug, id))) candidates.push({ categorySlug: fromCategorySlug, folder: id })
  }
  if (fromCategorySlug !== nextCategorySlug) {
    const byMarker = await findFolderByMarker(nextCategorySlug, id)
    if (byMarker) candidates.push({ categorySlug: nextCategorySlug, folder: byMarker })
    if (await pathExists(folderDir(nextCategorySlug, id))) candidates.push({ categorySlug: nextCategorySlug, folder: id })
  }

  let src: { categorySlug: string; folder: string } | null = null
  for (const c of candidates) {
    if (await pathExists(folderDir(c.categorySlug, c.folder))) {
      src = c
      break
    }
  }
  if (!src) return { categorySlug: nextCategorySlug, folder: targetFolder, moved: false }

  if (src.categorySlug === nextCategorySlug && src.folder === targetFolder) {
    await writeMarkerIfMissing(nextCategorySlug, targetFolder, id)
    return { categorySlug: nextCategorySlug, folder: targetFolder, moved: false }
  }

  const srcDir = folderDir(src.categorySlug, src.folder)
  const dstDir = folderDir(nextCategorySlug, targetFolder)
  await moveFolderContents(srcDir, dstDir).catch(() => undefined)
  await writeMarkerIfMissing(nextCategorySlug, targetFolder, id)
  return { categorySlug: nextCategorySlug, folder: targetFolder, moved: true }
}

export const resolveAssetFolderForRead = async (categorySlug: string, folderOrAssetId: string) => {
  const directDir = folderDir(categorySlug, folderOrAssetId)
  try {
    const marker = await readMarker(categorySlug, folderOrAssetId)
    if (marker) return folderOrAssetId
    await fs.promises.access(directDir, fs.constants.F_OK)
    return folderOrAssetId
  } catch {
    void 0
  }

  const db = getDb()
  const row = db.prepare('select id, category, name from assets where id = ?').get(folderOrAssetId) as
    | { id?: string; category?: string; name?: string }
    | undefined
  const assetId = typeof row?.id === 'string' ? row.id : ''
  if (!assetId) return null
  const category = typeof row?.category === 'string' ? row.category : ''
  if (slugifyCategory(category) !== categorySlug) return null
  const preferredFolder = slugifyAssetFolder(typeof row?.name === 'string' ? row.name : '')

  const preferredMarker = await readMarker(categorySlug, preferredFolder)
  if (preferredMarker === assetId) return preferredFolder

  const found = await findFolderByMarker(categorySlug, assetId)
  if (found) return found

  return preferredFolder
}
