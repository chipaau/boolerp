import { ErrorView } from '@/components/flows'
import { loadFlowError, oryConfig } from '@/lib/kratos'
import { FlowUnavailable } from '@/theme/flow-unavailable'

// Kratos sends the browser here with ?id= when a flow fails in a way the user must see.
export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams
  const error = id ? await loadFlowError(id).catch(() => undefined) : undefined
  if (!error) return <FlowUnavailable />
  return <ErrorView error={error} config={oryConfig()} />
}
