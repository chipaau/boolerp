import { createFileRoute } from '@tanstack/react-router'
import { signIn } from '@/lib/session'

// Sign-in is the BFF's (/auth/login), which sends the browser through the login service and back.
// This route only keeps /login links working.
export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): { return_to?: string } => ({
    return_to: typeof s.return_to === 'string' ? s.return_to : undefined,
  }),
  beforeLoad: ({ search }) => signIn(search.return_to ?? '/'),
})
