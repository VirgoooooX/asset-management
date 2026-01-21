import { apiFetch } from './apiClient'

const normalizePathFromUrl = (value: string) => {
  try {
    const url = new URL(value)
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
  const data = await apiFetch<{ url: string }>(`/api/files/upload?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!data?.url) throw new Error('Upload succeeded but missing url')
  return data.url
};

/**
 * 删除文件
 * @param path 文件路径 (例如: 'assets/images/my-image.jpg') or downloadURL
 */
export const deleteFile = async (pathOrUrl: string): Promise<void> => {
    if (!pathOrUrl) return;
    const path = pathOrUrl.startsWith('http') ? normalizePathFromUrl(pathOrUrl) : pathOrUrl
    if (!path) return
    await apiFetch(`/api/files/delete?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
}
