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
  return {
    categorySlug: slugifyCategory(category),
    preferredFolder: slugifyAssetFolder(name),
  }
}

const readMarker = async (categorySlug: string, folder: string) => {
  try {
    const content = await fs.promises.readFile(path.join(config.filesDir, categorySlug, folder, markerName), 'utf8')
    return content.trim()
  } catch {
    return null
  }
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
    if ((await readMarker(categorySlug, e.name)) === assetId) return e.name
  }
  return null
}

export const resolveLegacyAssetFolderForRead = async (categorySlug: string, folderOrAssetId: string) => {
  const directDir = path.join(config.filesDir, categorySlug, folderOrAssetId)
  try {
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
  if (slugifyCategory(typeof row?.category === 'string' ? row.category : '') !== categorySlug) return null

  const preferredFolder = slugifyAssetFolder(typeof row?.name === 'string' ? row.name : '')
  if ((await readMarker(categorySlug, preferredFolder)) === assetId) return preferredFolder

  return (await findFolderByMarker(categorySlug, assetId)) ?? preferredFolder
}
