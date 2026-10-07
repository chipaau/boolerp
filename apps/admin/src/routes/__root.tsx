import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { ToastProvider } from '@workspace/ui/components/toast'
import { useScrollbarReveal } from '@workspace/ui/hooks/use-scrollbar-reveal'

import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { ToastBridge } from '@/lib/query-client'

import '../styles.css'

/** What every route's loader gets: the console's QueryClient, to prefetch with (C174). */
export type RouterContext = { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  useScrollbarReveal()
  return (
    <ToastProvider>
      <ToastBridge />
      <Outlet />
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </ToastProvider>
  )
}
