import * as React from "react"
import { Toast } from "@base-ui/react/toast"
import { XIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The design's toast on Base UI's Toast (C214), which times, stacks, pauses on hover, swipes
 * away, and announces them: one cream pill at the bottom centre with a hex dot (sage when the
 * thing worked, terracotta when it did not), a line of text, an optional second line (`detail`,
 * such as the request's reference), and an optional Undo. An error stays longer, is announced
 * urgently, and can be dismissed. `useToast()` returns the `toast(text, { ok, detail, undo })`
 * function.
 */
type ToastOptions = { ok?: boolean; detail?: string; undo?: () => void; undoLabel?: string }
type ToastFn = (text: string, opts?: ToastOptions) => void

const ToastContext = React.createContext<ToastFn | null>(null)

/** One manager for the app, so a toast can be raised from anywhere under the provider. */
const manager = Toast.createToastManager()

const show: ToastFn = (text, opts) => {
  const ok = opts?.ok !== false
  const undo = opts?.undo
  const id: string = manager.add({
    title: text,
    description: opts?.detail,
    type: ok ? "ok" : "error",
    priority: ok ? "low" : "high",
    timeout: undo || !ok ? 6500 : 2600,
    actionProps: undo
      ? {
          children: opts?.undoLabel ?? "Undo",
          onClick: () => {
            manager.close(id)
            undo()
          },
        }
      : undefined,
  })
}

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((toast) => {
    const ok = toast.type !== "error"
    return (
      <Toast.Root
        key={toast.id}
        toast={toast}
        data-slot="toast"
        data-ok={ok}
        className={cn(
          "flex w-max max-w-full animate-rise items-center gap-[11px] bg-popover px-[18px] py-3 shadow-floating transition-opacity duration-200 data-[ending-style]:opacity-0 data-[limited]:hidden",
          toast.description ? "rounded-[18px]" : "rounded-full",
          !ok && "pe-2.5"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "block h-[9px] w-2 shrink-0 [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]",
            ok ? "bg-tone-success" : "bg-tone-risk"
          )}
        />
        <Toast.Content className="min-w-0 flex-1">
          <Toast.Title className="block text-ui-sm font-bold text-foreground" />
          <Toast.Description className="mt-0.5 block text-caption break-all text-muted-foreground" />
        </Toast.Content>
        {toast.actionProps && <Toast.Action className="ms-1 text-compact font-bold text-link hover:underline" />}
        {!ok && (
          <Toast.Close
            aria-label="Dismiss"
            className="-my-0.5 shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <XIcon className="size-4" />
          </Toast.Close>
        )}
      </Toast.Root>
    )
  })
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastContext.Provider value={show}>
      <Toast.Provider toastManager={manager} limit={3}>
        {children}
        <Toast.Portal>
          {/* The newest toast sits lowest; the others stack above it. */}
          <Toast.Viewport className="fixed bottom-7 left-1/2 z-70 flex w-max max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col-reverse items-center gap-2 outline-none">
            <ToastList />
          </Toast.Viewport>
        </Toast.Portal>
      </Toast.Provider>
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
