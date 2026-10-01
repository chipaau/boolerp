import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { FlowError } from '@ory/client-fetch'
import { Error as OryError } from '@ory/elements-react/theme'
import { frontend, oryConfig } from '@/lib/kratos'
import { boolComponents } from '@/theme/bool'
import { FlowUnavailable } from '@/theme/flow-unavailable'

// Kratos sends the browser here with ?id= when a flow fails in a way the user must see.
export const Route = createFileRoute('/error')({
  validateSearch: (s: Record<string, unknown>): { id?: string } => ({ id: typeof s.id === 'string' ? s.id : undefined }),
  component: Page,
})

function Page() {
  const { id } = Route.useSearch()
  const [error, setError] = useState<FlowError | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!id) return setFailed(true)
    frontend.getFlowError({ id }).then(setError, () => setFailed(true))
  }, [id])
  if (failed) return <FlowUnavailable />
  if (!error) return null
  return <OryError error={error} config={oryConfig} components={boolComponents} />
}
