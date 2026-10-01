import { useEffect, useState } from 'react'
import { loadFlow, type FlowKind, type Flows } from './kratos'

/** The flow named by ?flow=, or a new one (see loadFlow). */
export function useFlow<K extends FlowKind>(kind: K, flowId?: string, returnTo?: string) {
  const [flow, setFlow] = useState<Flows[K] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    loadFlow(kind, flowId, returnTo).then(
      (f) => !cancelled && setFlow(f),
      () => !cancelled && setFailed(true)
    )
    return () => {
      cancelled = true
    }
  }, [kind, flowId, returnTo])
  return { flow, failed }
}

export type FlowSearch = { flow?: string; return_to?: string }

export const validateFlowSearch = (s: Record<string, unknown>): FlowSearch => ({
  flow: typeof s.flow === 'string' ? s.flow : undefined,
  return_to: typeof s.return_to === 'string' ? s.return_to : undefined,
})
