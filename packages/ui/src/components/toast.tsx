import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The design's toast: one cream pill at the bottom centre with a hex dot (sage when the thing
 * worked, terracotta when it did not), a line of text, an optional second line (`detail`, such as
 * the request's reference), and an optional Undo. An error stays longer and can be dismissed.
 * One toast at a time; a new one replaces the last. `useToast()` returns the `toast(text, { ok, detail, undo })` function.
 */
type ToastOptions = { ok?: boolean; detail?: string; undo?: () => void; undoLabel?: string }
type ToastState = { text: string; ok: boolean; detail?: string; undo?: () => void; undoLabel: string } | null
type ToastFn = (text: string, opts?: ToastOptions) => void

const ToastContext = React.createContext<ToastFn | null>(null)

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<ToastState>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = React.useCallback<ToastFn>((text, opts) => {
    if (timer.current) clearTimeout(timer.current)
    const ok = opts?.ok !== false
    setToast({ text, ok, detail: opts?.detail, undo: opts?.undo, undoLabel: opts?.undoLabel ?? "Undo" })
    timer.current = setTimeout(() => setToast(null), opts?.undo || !ok ? 6500 : 2600)
  }, [])

  const dismiss = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setToast(null)
  }, [])

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role={toast.ok ? "status" : "alert"}
          data-slot="toast"
          data-ok={toast.ok}
          className={cn(
            "fixed bottom-7 left-1/2 z-70 flex w-max max-w-[calc(100vw-32px)] -translate-x-1/2 animate-rise items-center gap-[11px] bg-popover px-[18px] py-3 shadow-floating",
            toast.detail ? "rounded-[18px]" : "rounded-full",
            !toast.ok && "pe-2.5"
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "block h-[9px] w-2 shrink-0 [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]",
              toast.ok ? "bg-tone-success" : "bg-tone-risk"
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-ui-sm font-bold text-foreground">{toast.text}</span>
            {toast.detail && <span className="mt-0.5 block text-caption break-all text-muted-foreground">{toast.detail}</span>}
          </span>
          {toast.undo && (
            <button
              type="button"
              className="ms-1 text-compact font-bold text-link hover:underline"
              onClick={() => {
                const u = toast.undo
                setToast(null)
                u?.()
              }}
            >
              {toast.undoLabel}
            </button>
          )}
          {!toast.ok && (
            <button
              type="button"
              aria-label="Dismiss"
              className="-my-0.5 shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={dismiss}
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

function useToast(): ToastFn {
  const fn = React.useContext(ToastContext)
  if (!fn) throw new Error("useToast must be used within <ToastProvider>")
  return fn
}

export { ToastProvider, useToast }
export type { ToastOptions }
