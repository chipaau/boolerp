import { createFileRoute, redirect } from '@tanstack/react-router'
import { whoami } from '@workspace/auth'
import { DEFAULT_APP } from '@/lib/apps'

// Entry point: authenticated users land in the default app; everyone else goes to login.
export const Route = createFileRoute('/')({
  loader: async () => {
    const session = await whoami()
    if (session) {
      throw redirect({ to: '/$app', params: { app: DEFAULT_APP } })
    }
    throw redirect({ to: '/login', search: { return_to: '/' } })
  },
})
