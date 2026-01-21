import { getAccessToken, setAccessToken } from './session'

const baseUrl = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) ?? ''

const joinUrl = (path: string) => {
  if (!baseUrl) return path
  const a = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const b = path.startsWith('/') ? path : `/${path}`
  return a + b
}

export class ApiError extends Error {
  status: number
  bodyText?: string
  constructor(message: string, status: number, bodyText?: string) {
    super(message)
    this.status = status
    this.bodyText = bodyText
  }
}

const refreshOnce = async () => {
  const res = await fetch(joinUrl('/api/auth/refresh'), {
    method: 'POST',
    credentials: 'include'
  })
  if (!res.ok) return null
  const data = (await res.json().catch(() => null)) as any
  if (!data?.accessToken) return null
  setAccessToken(String(data.accessToken))
  return data
}

export const apiFetch = async <T>(
  path: string,
  init?: RequestInit & { retryOnAuth?: boolean }
): Promise<T> => {
  const allowRefresh = init?.retryOnAuth !== false

  const doFetch = async (withRefresh: boolean): Promise<Response> => {
    const headers = new Headers(init?.headers)
    const token = getAccessToken()
    if (token) headers.set('authorization', `Bearer ${token}`)
    if (!headers.has('accept')) headers.set('accept', 'application/json')
    const res = await fetch(joinUrl(path), { ...init, headers, credentials: 'include' })
    if (res.status === 401 && withRefresh) {
      const refreshed = await refreshOnce()
      if (refreshed?.accessToken) {
        return doFetch(false)
      }
    }
    return res
  }

  const res = await doFetch(allowRefresh)
  if (res.ok) {
    if (res.status === 204) return undefined as any
    return (await res.json()) as T
  }
  const text = await res.text().catch(() => '')
  throw new ApiError(text || res.statusText, res.status, text)
}
