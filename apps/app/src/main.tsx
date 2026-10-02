import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'


declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// All screen data flows through TanStack Query (features/*/queries.ts). Fixture-backed for now;
// the same hooks will call the generated API client.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

// Loaders get the query client from the router's context, to prefetch what a page reads.
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // preloading on hover runs loaders; let Query decide freshness instead of the router's cache
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
