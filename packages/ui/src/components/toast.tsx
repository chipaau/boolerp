import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The design's toast: one cream pill at the bottom centre with a hex dot (sage when the thing
 * worked, terracotta when it did not), a line of text, and an optional Undo. One toast at a time;
 * a new one replaces the last. `useToast()` returns the `toast(text, { ok, undo })` function.
 */
type ToastOptions = { ok?: boolean; undo?: () => void; undoLabel?: string }
type ToastState = { text: string; ok: boolean; undo?: () => void; undoLabel: string } | null
type ToastFn = (text: string, opts?: ToastOptions) => void

const ToastContext = React.createContext<ToastFn | null>(null)

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<ToastState>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = React.useCallback<ToastFn>((text, opts) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ text, ok: opts?.ok !== false, undo: opts?.undo, undoLabel: opts?.undoLabel ?? "Undo" })
    timer.current = setTimeout(() => setToast(null), opts?.undo ? 6500 : 2600)
  }, [])

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role="status"
          data-slot="toast"
          className="fixed bottom-7 left-1/2 z-70 flex -translate-x-1/2 animate-rise items-center gap-[11px] rounded-full bg-popover px-[18px] py-3 shadow-floating"
        >
          <span
            aria-hidden="true"
            className={cn("block h-[9px] w-2 [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]", toast.ok ? "bg-tone-success" : "bg-tone-risk")}
          />
          <span className="text-ui-sm font-bold text-foreground">{toast.text}</span>
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
