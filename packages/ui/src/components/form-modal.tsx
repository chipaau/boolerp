"use client"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"

/**
 * The centred form modal every create / edit / bulk-action flow uses: a title + note header, a body
 * that scrolls on its own inside a capped height, and a Cancel + commit footer. This is the one
 * shell for that shape — the side drawer it replaced had grown three separate implementations.
 *
 * `size` picks the width: `sm` (560px) for a short form, `lg` (720px) when the body is a list or a
 * side-by-side choice that a narrow column would crush.
 */
const SIZE = {
  sm: "sm:max-w-[560px]",
  lg: "sm:max-w-[720px]",
} as const

function FormModal({
  open,
  onClose,
  title,
  note,
  size = "sm",
  warn,
  footer,
  saveLabel,
  onSave,
  saveDisabled,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  note?: React.ReactNode
  size?: keyof typeof SIZE
  /** Amber-dot strip pinned under the body — a consequence worth reading before committing. */
  warn?: React.ReactNode
  /** Replaces the default Cancel + save pair outright when a flow needs its own actions. */
  footer?: React.ReactNode
  saveLabel?: string
  onSave?: () => void
  saveDisabled?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton
        className={cn("grid max-h-[86vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0", SIZE[size], className)}
      >
        <div className="border-b border-divider px-7 pt-6 pb-[18px] pe-16">
          <DialogTitle className="text-h3">{title}</DialogTitle>
          {note && <DialogDescription className="mt-1.5 text-compact leading-[1.5] text-muted-foreground">{note}</DialogDescription>}
        </div>

        <div className="min-h-0 overflow-y-auto px-7 pt-[22px] pb-[26px]">
          {children}
          {warn && <FormModalWarning>{warn}</FormModalWarning>}
        </div>

        <div className="flex flex-row items-center justify-end gap-3.5 border-t border-divider px-7 py-4">
          {footer ?? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={onSave} disabled={saveDisabled}>
                {saveLabel}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Small faint field/section label used inside a modal body. */
function FormModalLabel({ children, className, htmlFor }: { children: React.ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-2 block text-fine font-bold tracking-[0.03em] text-muted-foreground", className)}>
      {children}
    </label>
  )
}

/** Two-column field grid; pass `wide` on a field to span both columns. */
function FormModalGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-x-[18px] gap-y-4 sm:grid-cols-2", className)}>{children}</div>
}

/** Label + control + optional hint. */
function FormModalField({
  label,
  htmlFor,
  hint,
  wide,
  children,
}: {
  label: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <FormModalLabel htmlFor={htmlFor}>{label}</FormModalLabel>
      {children}
      {hint && <p className="mt-1.5 text-fine leading-normal text-faint">{hint}</p>}
    </div>
  )
}

/** Amber-dot warning strip at the foot of a modal body. */
function FormModalWarning({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" className="mt-[22px] flex items-start gap-2.5 rounded-lg bg-surface-band px-[15px] py-[13px] shadow-[inset_0_0_0_1px_var(--divider)]">
      <span aria-hidden="true" className="mt-1.5 size-[7px] shrink-0 rounded-full bg-tone-warning" />
      <span className="text-caption leading-[1.55] text-body">{children}</span>
    </div>
  )
}

/** Selectable card with a radio dot (role pickers, plan pickers). */
function FormModalChoice({
  selected,
  onSelect,
  label,
  note,
  className,
}: {
  selected: boolean
  onSelect: () => void
  label: React.ReactNode
  note?: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "rounded-lg p-3.5 text-left outline-none transition-[background-color,box-shadow] duration-instant ease-bool focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "bg-sage-soft shadow-[inset_0_0_0_1.5px_var(--sage)]" : "bg-surface-band shadow-[inset_0_0_0_1px_var(--divider)] hover:bg-secondary-hover/60",
        className
      )}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className={cn("grid size-3.5 place-items-center rounded-full", selected ? "bg-sage" : "shadow-[inset_0_0_0_1.5px_var(--input)]")}>
          {selected && <span className="size-1.5 rounded-full bg-card" />}
        </span>
        <span className="text-ui-sm font-bold text-foreground">{label}</span>
      </span>
      {note && <span className="mt-2 block text-fine leading-[1.45] text-muted-foreground">{note}</span>}
    </button>
  )
}

export { FormModal, FormModalLabel, FormModalGrid, FormModalField, FormModalWarning, FormModalChoice }
