import { apiFetch } from './apiClient'

const tryParseUrl = (value: string) => {
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) return new URL(value)
    if (typeof window !== 'undefined' && typeof window.location?.origin === 'string') {
      return new URL(value, window.location.origin)
    }
    return null
  } catch {
    return null
  }
}

export const normalizeFileUrlForDisplay = (value: string) => {
  const u = tryParseUrl(value)
  if (!u) return value
  if (u.pathname.startsWith('/api/')) return `${u.pathname}${u.search}`
  return value
}

const normalizePathFromUrl = (value: string) => {
  try {
    const url = tryParseUrl(value)
    if (!url) return value
    const queryPath = url.searchParams.get('path')
    if (queryPath) return queryPath
    return url.pathname.replace(/^\/+/, '')
  } catch {
    return value
  }
}

/**
 * 上传文件到后端文件服务
 * @param file 要上传的 File 对象
 * @param path 存储路径 (例如: 'assets/images/my-image.jpg')
 * @returns 下载 URL
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
  if (!file) throw new Error("No file provided");
  const dev = Boolean(((import.meta as any).env?.DEV as any) ?? false)
  if (dev) {
    console.debug('[uploadFile]', { name: file.name, size: file.size, type: file.type || undefined, path })
  }
  try {
    const data = await apiFetch<{ url: string }>(`/api/files/upload?path=${encodeURIComponent(path)}`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (!data?.url) throw new Error('Upload succeeded but missing url')
    const url = normalizeFileUrlForDisplay(data.url)
    if (dev) console.debug('[uploadFile] ok', { url })
    return url
  } catch (e: any) {
    if (dev) {
      console.debug('[uploadFile] error', {
        message: e?.message,
        status: e?.status,
        path: e?.path,
        bodyText: e?.bodyText ? String(e.bodyText).slice(0, 300) : undefined
      })
    }
    throw e
  }
};

/**
 * 删除文件
 * @param path 文件路径 (例如: 'assets/images/my-image.jpg') or downloadURL
 */
export const deleteFile = async (pathOrUrl: string): Promise<void> => {
    if (!pathOrUrl) return;
    const path = normalizePathFromUrl(pathOrUrl)
    if (!path) return
    await apiFetch(`/api/files/delete?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
}
