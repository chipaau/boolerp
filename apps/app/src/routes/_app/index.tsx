import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '@/features/home/home-page'

// Workspace home ("/"): greeting, calendar, smart inbox and the apps honeycomb. The `_app` layout
// above already guards the session, so anonymous visitors are redirected to /login before this renders.
export const Route = createFileRoute('/_app/')({
  wrapInSuspense: true,
  component: HomePage,
})
