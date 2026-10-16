import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { server } from '@/test/server'
import { renderRoute } from '@/test/render'

// The geographies screen's countries tab (C174, C218) on the real route tree against a faked API (MSW).

const country = (code: string, name: string, geographyCount = 0) => ({ code, alpha3: `${code}X`, name, phonePrefix: '+960', geographyCount })

/** Answers the countries list from `items`, keeping every request's query. */
function countriesApi(items: unknown[], total = items.length) {
  const seen: URLSearchParams[] = []
  server.use(
    http.get('/api/v1/countries', ({ request }) => {
      const q = new URL(request.url).searchParams
      seen.push(q)
      return HttpResponse.json({ items, page: Number(q.get('page')), pageSize: Number(q.get('pageSize')), total })
    })
  )
  return seen
}

describe('the countries tab', () => {
  it('lists the API countries with how many places each lists, read-only', async () => {
    const seen = countriesApi([country('MV', 'Maldives', 407), country('LK', 'Sri Lanka')], 249)
    renderRoute('/geographies/countries')

    const maldives = (await screen.findByText('Maldives')).closest('tr') as HTMLElement
    expect(within(maldives).getByText('407')).toBeInTheDocument()
    expect(within(maldives).getByText('/ MVX')).toBeInTheDocument()
    const sriLanka = screen.getByText('Sri Lanka').closest('tr') as HTMLElement
    expect(within(sriLanka).getByText('None yet')).toBeInTheDocument()
    expect(screen.getByText('249 countries')).toBeInTheDocument()
    // The API refuses parameters it does not know: only the list's own are sent.
    for (const q of seen) expect([...q.keys()].sort()).toEqual(['page', 'pageSize'])
    // Countries are the seeded ISO list: nothing to add or switch until operator writes exist.
    expect(screen.queryByRole('button', { name: /add a country/i })).not.toBeInTheDocument()
    expect(screen.queryByTitle(/deactivate|activate/i)).not.toBeInTheDocument()
  })

  it('searches on the server, with the search in the URL', async () => {
    const seen = countriesApi([country('MV', 'Maldives', 407)])
    const { router } = renderRoute('/geographies/countries')
    await screen.findByText('Maldives')

    await userEvent.type(screen.getByPlaceholderText('Filter by name or code'), 'mal')
    await waitFor(() => expect(seen.at(-1)?.get('q')).toBe('mal'))
    expect(router.state.location.pathname).toBe('/geographies/countries')
    expect(router.state.location.search).toMatchObject({ q: 'mal', page: 1 })
  })

  it('says so when the countries cannot be read', async () => {
    server.use(
      http.get('/api/v1/countries', () =>
        HttpResponse.json({ title: 'Service Unavailable', status: 503 }, { status: 503, headers: { 'X-Request-Id': 'req-c503' } })
      )
    )
    renderRoute('/geographies/countries')
    expect(await screen.findByText('Reference: req-c503')).toBeInTheDocument()
  })
})

describe('the geographies tabs (C218)', () => {
  it('has each tab at its own path: /geographies opens the first, and the tabs move between them', async () => {
    countriesApi([country('MV', 'Maldives', 407)])
    const { router } = renderRoute('/geographies')
    await waitFor(() => expect(router.state.location.pathname).toBe('/geographies/geographies'))
    expect(await screen.findByRole('button', { name: 'Add a geography' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Countries' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/geographies/countries'))
    expect(await screen.findByText('Maldives')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Geographies' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/geographies/geographies'))
  })

  it('still opens the countries tab from an old ?tab=countries link', async () => {
    countriesApi([country('MV', 'Maldives', 407)])
    const { router } = renderRoute('/geographies?tab=countries')
    await waitFor(() => expect(router.state.location.pathname).toBe('/geographies/countries'))
  })
})
