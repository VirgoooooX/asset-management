import type { AssetAttachment } from '../types'
import { uploadFile } from '../services/storageService'

export const sanitizeFileName = (name: string) =>
  name
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)

export const createObjectKey = (fileName: string) => {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${id}-${sanitizeFileName(fileName)}`
}

export const buildAssetUploadPath = (assetId: string, folder: string, fileName: string) =>
  `assets/${assetId}/${folder}/${createObjectKey(fileName)}`

export const uploadAssetFiles = async (assetId: string, folder: string, files: File[]): Promise<string[]> => {
  return Promise.all(
    files.map((file) => {
      const path = buildAssetUploadPath(assetId, folder, file.name)
      return uploadFile(file, path)
    })
  )
}

export const uploadAssetAttachments = async (
  assetId: string,
  folder: string,
  files: File[]
): Promise<AssetAttachment[]> => {
  return Promise.all(
    files.map(async (file) => {
      const objectKey = createObjectKey(file.name)
      const path = `assets/${assetId}/${folder}/${objectKey}`
      const url = await uploadFile(file, path)
      return {
        id: objectKey,
        name: file.name,
        url,
        path,
        contentType: file.type || undefined,
        size: typeof file.size === 'number' ? file.size : undefined,
        uploadedAt: new Date().toISOString(),
      }
    })
  )
}

export const isImageAttachment = (attachment: Pick<AssetAttachment, 'contentType' | 'name'>) => {
  const ct = (attachment.contentType || '').toLowerCase()
  if (ct.startsWith('image/')) return true
  const name = (attachment.name || '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)
}
