import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { createAppQueryClient } from '@/lib/query-client'
import { routeTree } from '@/routeTree.gen'

/**
 * Renders the real route tree at `url` with the console's own QueryClient (the error policy
 * included), without retries so failures show at once.
 */
export function renderRoute(url: string) {
  const queryClient = createAppQueryClient()
  queryClient.setDefaultOptions({ ...queryClient.getDefaultOptions(), queries: { ...queryClient.getDefaultOptions().queries, retry: false } })
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [url] }), context: { queryClient } })
  // The root route provides the toasts and the bridge to them, as in the app.
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { ...view, router, queryClient }
}
