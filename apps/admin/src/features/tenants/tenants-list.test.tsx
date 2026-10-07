import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { server } from '@/test/server'
import { renderRoute } from '@/test/render'

// The tenants list (F2e) on the real route tree against a faked API (MSW, C175).

const tenant = (n: number, over: Record<string, unknown> = {}) => ({
  id: `0192f6a0-0000-7000-8000-${String(n).padStart(12, '0')}`,
  slug: `tenant-${n}`,
  code: `T${n}`,
  name: `Tenant ${n}`,
  status: 'active',
  country: 'MV',
  parentId: null,
  parentName: null,
  workspaceHost: `tenant-${n}.bool.test`,
  createdAt: '2026-10-01T09:00:00Z',
  ...over,
})

/** Answers the list from `items`, keeping every request's query. */
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

const search = () => screen.getByLabelText('Filter by name, code, or slug')

describe('the tenants list', () => {
  it('shows the API tenants, with creating and the lifecycle actions disabled', async () => {
    listApi([tenant(1), tenant(2, { status: 'suspended', parentId: tenant(1).id, parentName: 'Tenant 1', workspaceHost: null })])
    renderRoute('/tenants')

    expect(await screen.findByText('T1 · tenant-1')).toBeInTheDocument()
    expect(screen.getByText('tenant-1.bool.test')).toBeInTheDocument()
    const row2 = screen.getByText('T2 · tenant-2').closest('tr') as HTMLElement
    expect(within(row2).getByText('suspended')).toBeInTheDocument()
    expect(within(row2).getByText('Tenant 1')).toBeInTheDocument() // its parent, named by the API (C188)
    expect(within(row2).getByRole('button', { name: 'Reactivate' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'New tenant' })).toBeDisabled()
    expect(screen.getByText('2 of 2 tenants')).toBeInTheDocument()
  })

  it('reads its state from the URL and sends it as the API parameters', async () => {
    const seen = listApi([tenant(1)])
    renderRoute('/tenants?page=2&pageSize=50&q=cyryx&status=suspended&sort=-createdAt')
    await screen.findByText('T1 · tenant-1')
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({ page: '2', pageSize: '50', q: 'cyryx', status: 'suspended', sort: '-createdAt' })
    expect(search()).toHaveValue('cyryx')
    expect(screen.getByRole('button', { name: 'Suspended' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('falls back to defaults for values the URL cannot hold', async () => {
    const seen = listApi([tenant(1)])
    renderRoute('/tenants?page=0&pageSize=500&status=pending&sort=slug')
    await screen.findByText('T1 · tenant-1')
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({ page: '1', pageSize: '25' })
  })

  it('searches, filters, and sorts on the API, going back to page 1', async () => {
    const seen = listApi([tenant(1)], 60)
    const { router } = renderRoute('/tenants?page=2')
    await screen.findByText('T1 · tenant-1')

    await userEvent.type(search(), 'cy')
    await waitFor(() => expect(seen.at(-1)!.get('q')).toBe('cy'))
    expect(seen.at(-1)!.get('page')).toBe('1')
    expect(router.state.location.search).toMatchObject({ q: 'cy', page: 1 })

    await userEvent.click(screen.getByRole('button', { name: 'Archived' }))
    await waitFor(() => expect(seen.at(-1)!.get('status')).toBe('archived'))

    await userEvent.click(screen.getByText('Tenant', { selector: 'th' }))
    await waitFor(() => expect(seen.at(-1)!.get('sort')).toBe('name'))
    await userEvent.click(screen.getByText('Tenant', { selector: 'th' }))
    await waitFor(() => expect(seen.at(-1)!.get('sort')).toBe('-name'))

    await userEvent.click(screen.getAllByText('Clear filters', { selector: 'button' })[0])
    await waitFor(() => expect(seen.at(-1)!.has('q')).toBe(false))
    expect(seen.at(-1)!.has('status')).toBe(false)
  })

  it('pages through the API', async () => {
    const seen = listApi([tenant(1)], 60)
    renderRoute('/tenants')
    await screen.findByText('T1 · tenant-1')
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Pagination' })).getByText('3'))
    await waitFor(() => expect(seen.at(-1)!.get('page')).toBe('3'))
  })

  it('tells an empty registry from no matches', async () => {
    listApi([])
    renderRoute('/tenants')
    expect(await screen.findByText('No tenants yet')).toBeInTheDocument()
  })

  it('shows no match with a way to clear the filters', async () => {
    listApi([])
    renderRoute('/tenants?status=archived')
    expect(await screen.findByText('No tenants match these filters')).toBeInTheDocument()
  })

  it('shows a 403 as a forbidden state', async () => {
    server.use(http.get('/api/v1/tenants', () => HttpResponse.json({ title: 'Forbidden', status: 403 }, { status: 403 })))
    renderRoute('/tenants')
    expect(await screen.findByText("You don't have access to this")).toBeInTheDocument()
  })

  it('shows a failure with the request reference and retries', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/tenants', () => {
        calls++
        return HttpResponse.json({ title: 'Service Unavailable', status: 503, detail: 'The service is unavailable right now.' }, { status: 503, headers: { 'X-Request-Id': 'req-503' } })
      })
    )
    renderRoute('/tenants')
    expect(await screen.findByText('Reference: req-503')).toBeInTheDocument()
    const before = calls
    await userEvent.click(screen.getByText('Try again'))
    await waitFor(() => expect(calls).toBeGreaterThan(before))
  })

  it('keeps the design prototype at /tenants-prototype until this list is accepted', async () => {
    renderRoute('/tenants-prototype')
    expect(await screen.findByRole('heading', { level: 1, name: 'Tenants' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New tenant' })).toBeEnabled()
  })
})
