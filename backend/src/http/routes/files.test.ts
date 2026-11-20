import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('files routes integration', () => {
  let tmpDir = ''
  let server: Server | null = null
  let baseUrl = ''
  let closeDbFn: (() => void) | null = null
  let adminToken = ''
  let userToken = ''

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-files-test-'))
    process.env.NODE_ENV = 'test'
    process.env.DATA_DIR = tmpDir
    process.env.JWT_SECRET = 'test-jwt-secret-key-min-16-chars'
    process.env.ADMIN_SEED_USER = 'admin'
    process.env.ADMIN_SEED_PASSWORD = 'test-admin-password-1'

    const { createApp } = await import('../app.js')
    const { closeDb } = await import('../../db/db.js')
    closeDbFn = closeDb

    const app = await createApp()
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s))
    })
    const addr = server.address()
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server')
    baseUrl = `http://127.0.0.1:${addr.port}`

    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'test-admin-password-1' }),
    })
    adminToken = String(((await adminLogin.json()) as { accessToken?: string }).accessToken ?? '')

    await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ username: 'file_viewer', password: 'user-password-123', role: 'user' }),
    })

    const userLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'file_viewer', password: 'user-password-123' }),
    })
    userToken = String(((await userLogin.json()) as { accessToken?: string }).accessToken ?? '')
  })

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()))
    }
    closeDbFn?.()
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('uploads, downloads, sandboxes svg, supports legacy path read fallback, blocks traversal and unauthorized mutations, and deletes', async () => {
    const assetRes = await fetch(`${baseUrl}/api/assets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ type: 'chamber', name: 'File-Chamber', category: 'Thermal', status: 'available' }),
    })
    expect(assetRes.status).toBe(200)
    const assetJson = (await assetRes.json()) as { id: string }
    const assetId = assetJson.id

    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3])
    const uploadRes = await fetch(
      `${baseUrl}/api/files/upload?path=${encodeURIComponent(`assets/${assetId}/sample.png`)}`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'image/png' },
        body: pngBytes,
      }
    )
    expect(uploadRes.status).toBe(200)
    const uploadJson = (await uploadRes.json()) as { url: string; path: string }
    expect(uploadJson.path).toBe(`by-asset/${assetId}/sample.png`)

    const downloadRes = await fetch(
      `${baseUrl}/api/files/file?path=${encodeURIComponent(uploadJson.path)}`,
      { headers: { authorization: `Bearer ${userToken}` } }
    )
    expect(downloadRes.status).toBe(200)
    expect(downloadRes.headers.get('content-type')).toContain('image/png')
    expect(new Uint8Array(await downloadRes.arrayBuffer())).toEqual(pngBytes)

    const traversal = await fetch(
      `${baseUrl}/api/files/file?path=${encodeURIComponent('by-asset/../../etc/passwd')}`,
      { headers: { authorization: `Bearer ${adminToken}` } }
    )
    expect(traversal.status).toBe(400)

    const svgRes = await fetch(
      `${baseUrl}/api/files/upload?path=${encodeURIComponent(`assets/${assetId}/diagram.svg`)}`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'image/svg+xml' },
        body: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
      }
    )
    expect(svgRes.status).toBe(200)
    const svgJson = (await svgRes.json()) as { path: string }
    const svgGet = await fetch(`${baseUrl}/api/files/file?path=${encodeURIComponent(svgJson.path)}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(svgGet.status).toBe(200)
    expect(svgGet.headers.get('content-security-policy')).toBe('sandbox')
    expect(svgGet.headers.get('content-disposition')).toContain('attachment')

    const folderName = `file-chamber_${assetId.slice(0, 8)}`
    const legacyDiskPath = path.join(tmpDir, 'files', 'thermal', folderName, 'legacy.txt')
    fs.mkdirSync(path.dirname(legacyDiskPath), { recursive: true })
    fs.writeFileSync(legacyDiskPath, 'legacy-hello', 'utf8')
    const legacyGet = await fetch(
      `${baseUrl}/api/files/file?path=${encodeURIComponent(`files/thermal/${folderName}/legacy.txt`)}`,
      { headers: { authorization: `Bearer ${userToken}` } }
    )
    expect(legacyGet.status).toBe(200)
    expect(await legacyGet.text()).toBe('legacy-hello')

    const userUpload = await fetch(
      `${baseUrl}/api/files/upload?path=${encodeURIComponent(`assets/${assetId}/unauth.png`)}`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${userToken}`, 'content-type': 'image/png' },
        body: pngBytes,
      }
    )
    expect(userUpload.status).toBe(403)

    const userDel = await fetch(
      `${baseUrl}/api/files/delete?path=${encodeURIComponent(uploadJson.path)}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${userToken}` } }
    )
    expect(userDel.status).toBe(403)

    const adminDel = await fetch(
      `${baseUrl}/api/files/delete?path=${encodeURIComponent(uploadJson.path)}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${adminToken}` } }
    )
    expect(adminDel.status).toBe(200)

    const afterDel = await fetch(
      `${baseUrl}/api/files/file?path=${encodeURIComponent(uploadJson.path)}`,
      { headers: { authorization: `Bearer ${adminToken}` } }
    )
    expect(afterDel.status).toBe(404)
  })
})
