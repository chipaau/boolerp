import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AuthShell } from '@workspace/auth'

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
      title="Something went wrong"
      footer={
        <Link
          to="/login"
          search={{ flow: undefined, return_to: undefined }}
          className="text-link hover:underline hover:underline-offset-[3px]"
        >
          Back to sign in
        </Link>
      }
    >
      <p className="rounded-full bg-destructive-soft px-[18px] py-3 text-[13.5px] text-destructive">{message}</p>
    </AuthShell>
  )
}
