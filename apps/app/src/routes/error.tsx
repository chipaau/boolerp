import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AuthShell } from '@/components/auth-shell'

// Kratos redirects self-service errors here with ?id=; we fetch the error detail to display.
export const Route = createFileRoute('/error')({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === 'string' ? s.id : undefined,
  }),
  component: ErrorPage,
})

function ErrorPage() {
  const { id } = Route.useSearch()
  const [message, setMessage] = useState('Something went wrong.')

  useEffect(() => {
    if (!id) return
    fetch(`/auth/self-service/errors?id=${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((d) => setMessage(d?.error?.message ?? d?.error?.reason ?? 'Something went wrong.'))
      .catch(() => {})
  }, [id])

  return (
    <AuthShell
      title="Error"
      footer={
        <Link to="/login" className="underline">
          Back to sign in
        </Link>
      }
    >
      <p className="text-sm text-muted-foreground">{message}</p>
    </AuthShell>
  )
}
