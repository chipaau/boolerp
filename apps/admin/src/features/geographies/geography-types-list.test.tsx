import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { server } from '@/test/server'
import { renderRoute } from '@/test/render'

// The geographies screen's geography types tab (C174, C218, C220) on the real route tree against a
// faked API (MSW).

const type = (n: number, country: string, code: string, name: string, level: number, placeCount: number) => ({
  id: `0192f6a0-0000-7000-8000-${String(n).padStart(12, '0')}`,
  country, code, name, level, placeCount,
})

function api(items: unknown[], total = items.length) {
  const seen: URLSearchParams[] = []
  server.use(
    http.get('/api/v1/geography-types', ({ request }) => {
      const q = new URL(request.url).searchParams
      seen.push(q)
      return HttpResponse.json({ items, page: Number(q.get('page')), pageSize: Number(q.get('pageSize')), total })
    }),
    http.get('/api/v1/countries', () =>
      HttpResponse.json({
        items: [
          { code: 'MV', alpha3: 'MDV', name: 'Maldives', phonePrefix: '+960', geographyCount: 407 },
          { code: 'US', alpha3: 'USA', name: 'United States', phonePrefix: '+1', geographyCount: 51 },
        ],
        page: 1, pageSize: 300, total: 2,
      })
    )
  )
  return seen
}

const items = [type(1, 'MV', 'island', 'Island', 2, 190), type(2, 'US', 'city', 'City', 2, 0)]

describe('the geography types tab', () => {
  it("lists every country's address levels with their places, typed where none are listed", async () => {
    const seen = api(items, 370)
    renderRoute('/geographies/geography-types')

    const island = (await screen.findByText('Island')).closest('tr') as HTMLElement
    expect(within(island).getByText('190')).toBeInTheDocument()
    await waitFor(() => expect(within(island).getByText('Maldives')).toBeInTheDocument())
    const city = screen.getByText('City').closest('tr') as HTMLElement
    expect(within(city).getByText('Typed')).toBeInTheDocument()
    expect(within(city).getByText('United States')).toBeInTheDocument()
    expect(screen.getByText('370 address levels')).toBeInTheDocument()
    for (const q of seen) expect([...q.keys()].sort()).toEqual(['page', 'pageSize'])
  })

  it('filters by country on the server, picked in a searchable combobox, with it in the URL', async () => {
    const seen = api(items)
    const { router } = renderRoute('/geographies/geography-types')
    await screen.findByText('Island')

    await userEvent.type(screen.getByRole('combobox', { name: 'Country' }), 'mal')
    await userEvent.click(await screen.findByRole('option', { name: /Maldives/ }))
    await waitFor(() => expect(seen.at(-1)?.get('country')).toBe('MV'))
    expect(router.state.location.pathname).toBe('/geographies/geography-types')
    expect(router.state.location.search).toMatchObject({ country: 'MV', page: 1 })
  })

  it('is the third tab', async () => {
    api(items)
    const { router } = renderRoute('/geographies/countries')
    await userEvent.click(await screen.findByRole('tab', { name: 'Geography types' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/geographies/geography-types'))
  })
})
