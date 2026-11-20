import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('usageLogs routes integration', () => {
  let tmpDir = ''
  let server: Server | null = null
  let baseUrl = ''
  let closeDbFn: (() => void) | null = null
  let token = ''

  const api = async (urlPath: string, init: RequestInit = {}) => {
    const res = await fetch(`${baseUrl}${urlPath}`, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : null),
        ...(token ? { authorization: `Bearer ${token}` } : null),
        ...(init.headers || null),
      },
    })
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    return { res, json }
  }

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-usagelogs-test-'))
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

    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'test-admin-password-1' }),
    })
    expect(login.res.status).toBe(200)
    token = String(login.json?.accessToken ?? '')
    expect(token.length).toBeGreaterThan(10)
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

  it('supports filtering, pagination, mutation item return, and asset status sync', async () => {
    const a1Res = await api('/api/assets', {
      method: 'POST',
      body: JSON.stringify({ type: 'chamber', name: 'Chamber-A', status: 'available', hourlyRateCents: 1000 }),
    })
    expect(a1Res.res.status).toBe(200)
    const a1Id = String(a1Res.json?.id)

    const a2Res = await api('/api/assets', {
      method: 'POST',
      body: JSON.stringify({ type: 'chamber', name: 'Chamber-B', status: 'available', hourlyRateCents: 1000 }),
    })
    const a2Id = String(a2Res.json?.id)

    const pRes = await api('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Project-Alpha' }),
    })
    expect(pRes.res.status).toBe(200)
    const p1Id = String(pRes.json?.id)

    const l1 = await api('/api/usage-logs', {
      method: 'POST',
      body: JSON.stringify({
        chamberId: a1Id,
        projectId: p1Id,
        startTime: '2026-03-01T00:00:00.000Z',
        endTime: '2026-03-01T02:00:00.000Z',
        user: 'alice',
        status: 'completed',
      }),
    })
    expect(l1.res.status).toBe(200)
    expect((l1.json?.item as { costCentsSnapshot?: number })?.costCentsSnapshot).toBe(2000)

    const l2 = await api('/api/usage-logs', {
      method: 'POST',
      body: JSON.stringify({
        chamberId: a1Id,
        startTime: '2026-03-05T00:00:00.000Z',
        endTime: '2026-03-06T00:00:00.000Z',
        user: 'bob',
        status: 'in-progress',
      }),
    })
    expect(l2.res.status).toBe(200)
    const l2Id = String(l2.json?.id)

    await api('/api/usage-logs', {
      method: 'POST',
      body: JSON.stringify({
        chamberId: a2Id,
        startTime: '2026-03-10T00:00:00.000Z',
        endTime: '2026-03-10T03:00:00.000Z',
        user: 'charlie',
        status: 'completed',
      }),
    })

    const afterCreateAsset = await api(`/api/assets/${encodeURIComponent(a1Id)}`)
    expect((afterCreateAsset.json?.item as { status?: string })?.status).toBe('in-use')

    const byChamber = await api(`/api/usage-logs?chamberId=${encodeURIComponent(a1Id)}`)
    expect(byChamber.res.status).toBe(200)
    expect(byChamber.json?.total).toBe(2)
    expect((byChamber.json?.items as unknown[]).length).toBe(2)

    const byProject = await api(`/api/usage-logs?projectId=${encodeURIComponent(p1Id)}`)
    expect(byProject.json?.total).toBe(1)

    const byStatus = await api('/api/usage-logs?status=completed')
    expect(byStatus.json?.total).toBe(2)

    const byFromTo = await api(
      '/api/usage-logs?from=2026-03-04T00:00:00.000Z&to=2026-03-08T00:00:00.000Z'
    )
    expect(byFromTo.json?.total).toBe(1)
    expect((byFromTo.json?.items as Array<{ id: string }>)[0].id).toBe(l2Id)

    const page1 = await api('/api/usage-logs?limit=2&offset=0')
    expect(page1.json?.total).toBe(3)
    expect((page1.json?.items as unknown[]).length).toBe(2)

    const page2 = await api('/api/usage-logs?limit=2&offset=2')
    expect(page2.json?.total).toBe(3)
    expect((page2.json?.items as unknown[]).length).toBe(1)

    expect((await api('/api/usage-logs?status=bad')).res.status).toBe(400)
    expect((await api('/api/usage-logs?limit=0')).res.status).toBe(400)
    expect((await api('/api/usage-logs?limit=501')).res.status).toBe(400)
    expect((await api('/api/usage-logs?from=not-a-date')).res.status).toBe(400)

    const patched = await api(`/api/usage-logs/${encodeURIComponent(l2Id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed', endTime: '2026-03-05T03:00:00.000Z' }),
    })
    expect(patched.res.status).toBe(200)
    expect((patched.json?.item as { status?: string; billableHoursSnapshot?: number })?.status).toBe('completed')
    expect((patched.json?.item as { billableHoursSnapshot?: number })?.billableHoursSnapshot).toBe(3)

    const assetReleased = await api(`/api/assets/${encodeURIComponent(a1Id)}`)
    expect((assetReleased.json?.item as { status?: string })?.status).toBe('available')

    const del = await api(`/api/usage-logs/${encodeURIComponent(l2Id)}`, { method: 'DELETE' })
    expect(del.res.status).toBe(200)

    const remaining = await api(`/api/usage-logs?chamberId=${encodeURIComponent(a1Id)}`)
    expect(remaining.json?.total).toBe(1)
  })
})
