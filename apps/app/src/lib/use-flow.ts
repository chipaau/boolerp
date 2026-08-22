import { useCallback, useEffect, useState } from 'react'
import {
  createFlow,
  getFlow,
  submit,
  FlowError,
  type Flow,
  type FlowKind,
  type Session,
} from '@/lib/kratos'

type Options = {
  flowId?: string
  onSuccess?: (session?: Session) => void
}

// useKratosFlow owns a self-service flow's lifecycle: fetch/create it, submit values, re-render on
// validation errors, follow Kratos redirects (e.g. recovery → settings), and recreate on expiry.
export function useKratosFlow(kind: FlowKind, opts: Options = {}) {
  const { flowId, onSuccess } = opts
  const [flow, setFlow] = useState<Flow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const f = flowId ? await getFlow(kind, flowId) : await createFlow(kind)
        if (!cancelled) setFlow(f)
      } catch {
        try {
          const f = await createFlow(kind)
          if (!cancelled) setFlow(f)
        } catch {
          if (!cancelled) setError('Could not start. Please retry.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [kind, flowId])

  const onSubmit = useCallback(
    async (body: Record<string, string>) => {
      if (!flow) return
      setSubmitting(true)
      setError(null)
      try {
        const res = await submit(flow, body)
        if (res.kind === 'success') {
          onSuccess?.(res.session)
          return
        }
        if (res.kind === 'flow') {
          setFlow(res.flow)
          return
        }
        if (res.kind === 'redirect') {
          window.location.href = res.to
          return
        }
        if (res.kind === 'handoff') {
          // Kratos handed us another flow's UI (e.g. recovery → settings). Open it with its id.
          const path = res.kind_of === 'verification' ? '/verify' : `/${res.kind_of}`
          window.location.href = `${path}?flow=${res.flowId}`
          return
        }
      } catch (e) {
        if (e instanceof FlowError && (e.status === 410 || e.status === 404 || e.status === 403)) {
          try {
            setFlow(await createFlow(kind))
          } catch {
            setError('Session expired. Please retry.')
          }
          return
        }
        setError('Something went wrong. Please try again.')
      } finally {
        setSubmitting(false)
      }
    },
    [flow, kind, onSuccess],
  )

  return { flow, submitting, error, onSubmit }
}
