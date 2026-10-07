// The console's QueryClient with the one error policy (C185): general errors (permission,
// conflict, server, network) are shown in one place, as a toast, through ToastBridge.
import { useEffect } from 'react'
import { createQueryClient } from '@workspace/api'
import { useToast } from '@workspace/ui/components/toast'

type Toast = ReturnType<typeof useToast>

/** The toast the policy shows messages with; set by ToastBridge once the provider renders. */
let toast: Toast | null = null

/** Creates the console's QueryClient (one per app; tests make their own). */
export function createAppQueryClient() {
  return createQueryClient({
    notify: (message, { reference }) => toast?.(reference ? `${message} Reference: ${reference}` : message, { ok: false }),
  })
}

/** Connects the policy to the app's toast; rendered once inside ToastProvider (routes/__root.tsx). */
export function ToastBridge() {
  const t = useToast()
  useEffect(() => {
    toast = t
    return () => {
      if (toast === t) toast = null
    }
  }, [t])
  return null
}
