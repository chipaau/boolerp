import { describe, expect, it, vi } from 'vitest'
import { HttpResponse, http } from 'msw'
import { ApiError } from '@workspace/api'
import { createAppQueryClient } from '@/lib/query-client'
import { server } from '@/test/server'
import { tenantKeys, tenantQueries } from './api'
import { tenantListSearch } from './schemas'

// The tenants data layer (F2d) against a faked API (MSW, C175): what the list query sends, what it
// accepts, and how it fails. No UI.

const tenant = (n: number, over: Record<string, unknown> = {}) => ({
  id: `0192f6a0-0000-7000-8000-${String(n).padStart(12, '0')}`,
  slug: `tenant-${n}`,
  code: `T${n}`,
  name: `Tenant ${n}`,
  status: 'active',
  country: 'MV',
  parentId: null,
  workspaceHost: `tenant-${n}.bool.test`,
  createdAt: '2026-10-01T09:00:00Z',
  ...over,
})

/** Answers the list with `items`, keeping each request's query. */
function listApi(items: unknown[], total = items.length) {
  const seen: URLSearchParams[] = []
  server.use(
    http.get('/api/v1/tenants', ({ request }) => {
      const q = new URL(request.url).searchParams
      seen.push(q)
      return HttpResponse.json({ items, page: Number(q.get('page')), pageSize: Number(q.get('pageSize')), total })
    })
  )
  return seen
}

const client = () => {
  const qc = createAppQueryClient()
  qc.setDefaultOptions({ queries: { retry: false } })
  return qc
}

describe('tenantListSearch', () => {
  it('reads the list URL with defaults, falling back on what it cannot hold', () => {
    expect(tenantListSearch.parse({})).toEqual({ page: 1, pageSize: 25 })
    expect(tenantListSearch.parse({ page: '2', q: 'cy', status: 'suspended', sort: '-createdAt' })).toEqual({
      page: 2,
      pageSize: 25,
      q: 'cy',
      status: 'suspended',
      sort: '-createdAt',
    })
    expect(tenantListSearch.parse({ status: 'pending', sort: 'slug', pageSize: '500' })).toEqual({ page: 1, pageSize: 25 })
  })
})

describe('tenantQueries.list', () => {
  it('sends the URL state as the API parameters and parses the page', async () => {
    const seen = listApi([tenant(1), tenant(2, { parentId: tenant(1).id, workspaceHost: null, status: 'provisioning' })], 42)
    const page = await client().fetchQuery(tenantQueries.list(tenantListSearch.parse({ page: '2', q: 'cy', status: 'active', sort: '-name' })))

    expect(Object.fromEntries(seen[0])).toEqual({ page: '2', pageSize: '25', q: 'cy', status: 'active', sort: '-name' })
    expect(page.total).toBe(42)
    expect(page.items.map((t) => t.code)).toEqual(['T1', 'T2'])
    expect(page.items[1]).toMatchObject({ parentId: tenant(1).id, workspaceHost: null, status: 'provisioning' })
  })

  it('leaves out what the URL does not set', async () => {
    const seen = listApi([])
    await client().fetchQuery(tenantQueries.list(tenantListSearch.parse({})))
    expect(Object.fromEntries(seen[0])).toEqual({ page: '1', pageSize: '25' })
  })

  it('keys each page and filter apart, under the tenants lists', () => {
    const a = tenantQueries.list(tenantListSearch.parse({ page: '1' })).queryKey
    const b = tenantQueries.list(tenantListSearch.parse({ page: '2' })).queryKey
    expect(a).not.toEqual(b)
    expect(a.slice(0, 3)).toEqual(tenantKeys.lists())
  })

  it('fails with an ApiError the screen can show: forbidden', async () => {
    server.use(http.get('/api/v1/tenants', () => HttpResponse.json({ title: 'Forbidden', status: 403 }, { status: 403 })))
    const e = await client().fetchQuery(tenantQueries.list(tenantListSearch.parse({}))).catch((err: unknown) => err)
    expect(e).toBeInstanceOf(ApiError)
    expect((e as ApiError).forbidden).toBe(true)
  })

  it('refuses a page that breaks the contract instead of returning it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    listApi([tenant(1, { status: 'paused' })])
    const e = await client().fetchQuery(tenantQueries.list(tenantListSearch.parse({}))).catch((err: unknown) => err)
    expect(e).toMatchObject({ kind: 'contract' })
    expect((e as ApiError).detail).toContain('status')
    vi.restoreAllMocks()
  })
})
