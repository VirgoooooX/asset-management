import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('reports and repairTickets routes integration', () => {
  let tmpDir = ''
  let server: Server | null = null
  let baseUrl = ''
  let closeDbFn: (() => void) | null = null
  let adminToken = ''
  let userToken = ''

  const api = async (urlPath: string, tokenStr: string, init: RequestInit = {}) => {
    const res = await fetch(`${baseUrl}${urlPath}`, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : null),
        ...(tokenStr ? { authorization: `Bearer ${tokenStr}` } : null),
        ...(init.headers || null),
      },
    })
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    return { res, json }
  }

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-reports-test-'))
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

    const adminLogin = await api('/api/auth/login', '', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'test-admin-password-1' }),
    })
    expect(adminLogin.res.status).toBe(200)
    adminToken = String(adminLogin.json?.accessToken ?? '')

    const createUser = await api('/api/admin/users', adminToken, {
      method: 'POST',
      body: JSON.stringify({ username: 'normal_user', password: 'user-password-123', role: 'user' }),
    })
    expect(createUser.res.status).toBe(200)

    const userLogin = await api('/api/auth/login', '', {
      method: 'POST',
      body: JSON.stringify({ username: 'normal_user', password: 'user-password-123' }),
    })
    expect(userLogin.res.status).toBe(200)
    userToken = String(userLogin.json?.accessToken ?? '')
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

  it('enforces manager role on project-cost reports and validates range parameters', async () => {
    const startMs = Date.parse('2026-04-01T00:00:00.000Z')
    const endMs = Date.parse('2026-04-10T00:00:00.000Z')

    const forbidden = await api(
      `/api/reports/project-cost?rangeStartMs=${startMs}&rangeEndMs=${endMs}`,
      userToken
    )
    expect(forbidden.res.status).toBe(403)

    const ok = await api(
      `/api/reports/project-cost?rangeStartMs=${startMs}&rangeEndMs=${endMs}`,
      adminToken
    )
    expect(ok.res.status).toBe(200)
    expect(ok.json).toHaveProperty('summary')
    expect(Array.isArray(ok.json?.groups)).toBe(true)
    expect(Array.isArray(ok.json?.series)).toBe(true)

    const invalidRange = await api(
      `/api/reports/project-cost?rangeStartMs=${endMs}&rangeEndMs=${startMs}`,
      adminToken
    )
    expect(invalidRange.res.status).toBe(400)

    const tooLargeEnd = startMs + 366 * 6 * 24 * 60 * 60 * 1000
    const tooLarge = await api(
      `/api/reports/project-cost?rangeStartMs=${startMs}&rangeEndMs=${tooLargeEnd}`,
      adminToken
    )
    expect(tooLarge.res.status).toBe(400)
  })

  it('orders repair tickets by coalesce(updated_at, created_at) desc, paginates, and redacts sensitive fields for users', async () => {
    const a1 = await api('/api/assets', adminToken, {
      method: 'POST',
      body: JSON.stringify({ type: 'chamber', name: 'Repair-C1', status: 'available' }),
    })
    const a2 = await api('/api/assets', adminToken, {
      method: 'POST',
      body: JSON.stringify({ type: 'chamber', name: 'Repair-C2', status: 'available' }),
    })
    const a1Id = String(a1.json?.id)
    const a2Id = String(a2.json?.id)

    const t1 = await api('/api/repair-tickets', adminToken, {
      method: 'POST',
      body: JSON.stringify({ assetId: a1Id, problemDesc: 'Compressor noise' }),
    })
    const t1Id = String(t1.json?.id)

    await new Promise((r) => setTimeout(r, 15))
    const t2 = await api('/api/repair-tickets', adminToken, {
      method: 'POST',
      body: JSON.stringify({ assetId: a2Id, problemDesc: 'Sensor drift' }),
    })
    const t2Id = String(t2.json?.id)

    await new Promise((r) => setTimeout(r, 15))
    const trans = await api(`/api/repair-tickets/${encodeURIComponent(t1Id)}/transition`, adminToken, {
      method: 'POST',
      body: JSON.stringify({ to: 'repair-pending', vendorName: 'SecretVendor', quoteAmount: 4500 }),
    })
    expect(trans.res.status).toBe(200)

    const adminList = await api('/api/repair-tickets?limit=1&offset=0', adminToken)
    expect(adminList.res.status).toBe(200)
    expect(adminList.json?.total).toBe(2)
    const adminItems = adminList.json?.items as Array<Record<string, unknown>>
    expect(adminItems.length).toBe(1)
    expect(adminItems[0].id).toBe(t1Id)
    expect(adminItems[0].vendorName).toBe('SecretVendor')
    expect(adminItems[0].quoteAmount).toBe(4500)

    const adminPage2 = await api('/api/repair-tickets?limit=1&offset=1', adminToken)
    expect((adminPage2.json?.items as Array<{ id: string }>)[0].id).toBe(t2Id)

    const userList = await api('/api/repair-tickets', userToken)
    expect(userList.res.status).toBe(200)
    const userFirst = (userList.json?.items as Array<Record<string, unknown>>)[0]
    expect(userFirst.vendorName).toBeUndefined()
    expect(userFirst.quoteAmount).toBeUndefined()
    expect(userFirst.quoteAt).toBeUndefined()
    expect(userFirst.attachments).toBeUndefined()
  })
})
