import { createFileRoute, redirect } from '@tanstack/react-router'

// Kratos returns here after login by default; the account page is the home.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings', search: { flow: undefined, return_to: undefined } })
  },
})
