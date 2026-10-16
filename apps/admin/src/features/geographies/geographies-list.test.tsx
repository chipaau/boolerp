import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { server } from '@/test/server'
import { renderRoute } from '@/test/render'

// The geographies screen's geographies tab (C174, C218, C221) on the real route tree against a
// faked API (MSW).

const place = (n: number, over: Record<string, unknown>) => ({
  id: `0192f6a0-0000-7000-8000-${String(n).padStart(12, '0')}`,
  type: 'island', typeName: 'Island', level: 2, country: 'MV', code: null, name: 'Place', shortName: null,
  parentId: null, parentName: null, latitude: null, longitude: null, childCount: 0, hasChildren: false,
  ...over,
})

const kaafu = place(1, { type: 'atoll', typeName: 'Atoll', level: 1, code: 'MV-26', name: 'Kaafu', shortName: 'K.', childCount: 77, hasChildren: true })
const maafushi = place(2, { name: 'Maafushi', parentId: kaafu.id, parentName: 'Kaafu' })

function api(items: unknown[], total = items.length) {
  const seen: URLSearchParams[] = []
  const typesAsked: string[] = []
  server.use(
    http.get('/api/v1/geographies', ({ request }) => {
      const q = new URL(request.url).searchParams
      seen.push(q)
      return HttpResponse.json({ items, page: Number(q.get('page')), pageSize: Number(q.get('pageSize')), total })
    }),
    http.get('/api/v1/countries', () =>
      HttpResponse.json({
        items: [{ code: 'MV', alpha3: 'MDV', name: 'Maldives', phonePrefix: '+960', geographyCount: 407 }],
        page: 1, pageSize: 300, total: 1,
      })
    ),
    http.get('/api/v1/geography-types', ({ request }) => {
      typesAsked.push(new URL(request.url).searchParams.get('country') ?? '')
      return HttpResponse.json({
        items: [
          { id: '0192f6a0-0000-7000-8000-0000000000a1', country: 'MV', code: 'atoll', name: 'Atoll', level: 1, placeCount: 19 },
          { id: '0192f6a0-0000-7000-8000-0000000000a2', country: 'MV', code: 'island', name: 'Island', level: 2, placeCount: 190 },
        ],
        page: 1, pageSize: 100, total: 2,
      })
    })
  )
  return { seen, typesAsked }
}

describe('the geographies tab', () => {
  it('lists every place at every level, with its type, parent, country, and the places under it', async () => {
    const { seen } = api([kaafu, maafushi], 5413)
    renderRoute('/geographies/geographies')

    const k = (await screen.findByText('MV-26')).closest('tr') as HTMLElement
    expect(within(k).getByText('K.')).toBeInTheDocument()
    expect(within(k).getByText('77')).toBeInTheDocument()
    const m = screen.getByText('Maafushi').closest('tr') as HTMLElement
    expect(within(m).getAllByText('Kaafu').length).toBeGreaterThan(0)
    await waitFor(() => expect(within(m).getAllByText('Maldives').length).toBeGreaterThan(0))
    expect(screen.getByText('5,413 places')).toBeInTheDocument()
    // Every place: no parent asked, and only the list's own parameters sent.
    for (const q of seen) expect([...q.keys()].sort()).toEqual(['page', 'pageSize'])
  })

  it("filters by country, then by that country's address levels, with both in the URL", async () => {
    const { seen, typesAsked } = api([kaafu, maafushi])
    const { router } = renderRoute('/geographies/geographies')
    await screen.findByText('Maafushi')
    expect(screen.queryByRole('group', { name: 'Address level' })).not.toBeInTheDocument()

    await userEvent.type(screen.getByRole('combobox', { name: 'Country' }), 'mal')
    await userEvent.click(await screen.findByRole('option', { name: /Maldives/ }))
    await waitFor(() => expect(seen.at(-1)?.get('country')).toBe('MV'))
    expect(typesAsked).toContain('MV')

    const levels = await screen.findByRole('group', { name: 'Address level' })
    await userEvent.click(within(levels).getByRole('button', { name: 'Island' }))
    await waitFor(() => expect(seen.at(-1)?.get('type')).toBe('island'))
    expect(router.state.location.search).toMatchObject({ country: 'MV', type: 'island', page: 1 })
  })

  it('says so when the places cannot be read', async () => {
    api([])
    server.use(
      http.get('/api/v1/geographies', () =>
        HttpResponse.json({ title: 'Service Unavailable', status: 503 }, { status: 503, headers: { 'X-Request-Id': 'req-g503' } })
      )
    )
    renderRoute('/geographies/geographies')
    expect(await screen.findByText('Reference: req-g503')).toBeInTheDocument()
  })
})
