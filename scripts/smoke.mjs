const baseUrl = process.env.CHAMBER_API_BASE_URL || 'http://localhost:8080'
const username = process.env.CHAMBER_ADMIN_USER || 'admin'
const password = process.env.CHAMBER_ADMIN_PASSWORD || 'admin123'

const fail = (msg) => {
  throw new Error(msg)
}

const joinUrl = (path) => {
  const a = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const b = path.startsWith('/') ? path : `/${path}`
  return a + b
}

const jsonFetch = async (path, init = {}) => {
  const res = await fetch(joinUrl(path), {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : null),
      ...(init.headers || null),
    },
  })
  const requestId = res.headers.get('x-request-id') || undefined
  const text = await res.text().catch(() => '')
  const data = text ? JSON.parse(text) : null
  return { res, data, requestId }
}

const main = async () => {
  const health = await jsonFetch('/api/health')
  if (!health.res.ok) fail(`health_failed_${health.res.status}`)
  if (!health.requestId) fail('missing_x_request_id_health')

  const login = await jsonFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  if (!login.res.ok) fail(`login_failed_${login.res.status}`)
  const token = login.data?.accessToken
  if (!token) fail('missing_access_token')

  const authHeader = { authorization: `Bearer ${token}` }

  const rates = await jsonFetch('/api/admin/asset-category-rates', { headers: authHeader })
  if (!rates.res.ok) fail(`category_rates_failed_${rates.res.status}`)
  if (!Array.isArray(rates.data?.items)) fail('category_rates_invalid_items')

  const assetCreate = await jsonFetch('/api/assets', {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      type: 'chamber',
      name: `smoke-${Date.now()}`,
      status: 'available',
      category: 'SMOKE',
    }),
  })
  if (!assetCreate.res.ok) fail(`asset_create_failed_${assetCreate.res.status}`)
  const createdAssetId = assetCreate.data?.id
  if (!createdAssetId) fail('asset_create_missing_id')
  const createRid = assetCreate.requestId
  if (!createRid) fail('asset_create_missing_x_request_id')

  const audit = await jsonFetch(`/api/admin/audit-logs?requestId=${encodeURIComponent(createRid)}&page=0&pageSize=50`, {
    headers: authHeader,
  })
  if (!audit.res.ok) fail(`audit_logs_failed_${audit.res.status}`)
  const items = audit.data?.items
  if (!Array.isArray(items) || items.length === 0) fail('audit_logs_no_items_for_request_id')
  const anyBad = items.some((it) => it.requestId !== createRid || !it.ip || !it.userAgent)
  if (anyBad) fail('audit_logs_missing_context_fields')

  const csvRes = await fetch(joinUrl(`/api/admin/audit-logs/export?requestId=${encodeURIComponent(createRid)}&limit=100`), {
    method: 'GET',
    headers: authHeader,
  })
  if (!csvRes.ok) fail(`audit_export_failed_${csvRes.status}`)
  const csvType = csvRes.headers.get('content-type') || ''
  if (!csvType.includes('text/csv')) fail('audit_export_bad_content_type')
  const csvText = await csvRes.text()
  if (!csvText.startsWith('id,at,actor_user_id')) fail('audit_export_bad_header')

  const del = await jsonFetch(`/api/assets/${encodeURIComponent(createdAssetId)}`, { method: 'DELETE', headers: authHeader })
  if (!del.res.ok) fail(`asset_delete_failed_${del.res.status}`)

  const backfill = await jsonFetch('/api/admin/backfill/cost-snapshots?limit=5', { method: 'POST', headers: authHeader })
  if (!backfill.res.ok) fail(`backfill_failed_${backfill.res.status}`)
  if (backfill.data?.ok !== true) fail('backfill_response_not_ok')

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        user: login.data?.user?.username || username,
        requestId: createRid,
        createdAssetId,
        categoryRateCount: rates.data?.items?.length ?? 0,
        auditMatchCount: items.length,
      },
      null,
      2
    ) + '\n'
  )
}

main().catch((e) => {
  process.exitCode = 1
  process.stderr.write(String(e?.message || e) + '\n')
})

