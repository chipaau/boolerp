import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { MutationObserver } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { ApiError } from '@workspace/api'
import { server } from '@/test/server'
import { renderRoute } from '@/test/render'

// The console's plumbing (F2c): the session guard through the BFF, the router context's
// QueryClient, and the one error policy shown as a toast (C185).

describe('the console', () => {
  it('opens the console for the signed-in person (the session guard asks the BFF)', async () => {
    renderRoute('/')
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('sends a signed-out browser to sign in, returning to the same page', async () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign })
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ title: 'Unauthorized' }, { status: 401 })))
    renderRoute('/billing')
    await waitFor(() => expect(assign).toHaveBeenCalledWith(expect.stringMatching(/^\/auth\/login\?return_to=/)))
    vi.restoreAllMocks()
  })

  it('shows a general API error as a toast, with the reference', async () => {
    const { queryClient } = renderRoute('/')
    await screen.findByRole('heading', { name: 'Dashboard' })
    const failing = new MutationObserver(queryClient, {
      mutationFn: () => Promise.reject(new ApiError({ kind: 'http', status: 503, title: 'Service Unavailable', requestId: 'req-503' })),
    })
    await failing.mutate().catch(() => {})
    expect(await screen.findByText('The service is unavailable right now. Try again shortly. Reference: req-503')).toBeInTheDocument()
  })

  it('passes its QueryClient to every route through the router context', () => {
    const { router, queryClient } = renderRoute('/')
    expect(router.options.context).toEqual({ queryClient })
  })
})
