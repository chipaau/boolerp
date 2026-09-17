"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

export type StepperStep = { title: React.ReactNode; hint?: React.ReactNode }

type StepperProps = Omit<React.ComponentProps<"nav">, "title"> & {
  /** Overline above the steps, e.g. "New employee". */
  title?: React.ReactNode
  steps: StepperStep[]
  /** Zero-based index of the step on screen. */
  current: number
  /** Whether step `i` is filled in well enough to move past. Defaults to always true. */
  complete?: (i: number) => boolean
  /** Called with the index of a reachable step the user picked. Omit for a read-only rail. */
  onStep?: (i: number) => void
}

/**
 * A vertical step rail for multi-step flows (horizontal numbers only below `sm`). The current step
 * sits on a soft brand tint; completed steps show a sage check; upcoming ones an outline disc.
 * A step can be picked when it is current, already visited, or every step before it is complete —
 * anything else is locked (`aria-disabled`).
 */
function Stepper({ title, steps, current, complete = () => true, onStep, className, ...props }: StepperProps) {
  // furthest step reached, so going back never locks what was already seen
  const [reached, setReached] = React.useState(current)
  React.useEffect(() => setReached((r) => Math.max(r, current)), [current])

  return (
    <nav data-slot="stepper" aria-label={typeof title === "string" ? title : "Steps"} className={className} {...props}>
      {title && <div className="mb-4 text-overline text-faint">{title}</div>}
      <ol className="relative flex flex-row gap-1 sm:flex-col">
        {steps.map((s, i) => {
          const here = i === current
          const done = !here && i < reached && complete(i)
          const open = here || i <= reached || steps.slice(0, i).every((_, j) => complete(j))
          return (
            <li key={i} className="relative">
              {i < steps.length - 1 && (
                <span aria-hidden="true" className="absolute top-[34px] bottom-[-6px] left-[22px] hidden w-px bg-border sm:block" />
              )}
              <button
                type="button"
                data-slot="stepper-step"
                data-state={here ? "current" : done ? "complete" : open ? "upcoming" : "locked"}
                aria-current={here ? "step" : undefined}
                aria-disabled={!open || !onStep || undefined}
                onClick={() => open && !here && onStep?.(i)}
                className={cn(
                  "relative flex w-full items-start gap-[11px] rounded-[11px] px-2.5 py-2 text-left outline-none transition-colors duration-instant ease-hexa focus-visible:ring-2 focus-visible:ring-ring",
                  here ? "bg-tone-warning-soft" : open && onStep ? "hover:bg-surface-soft" : "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "relative z-[1] grid size-[26px] shrink-0 place-items-center rounded-full text-fine font-bold transition-colors duration-instant ease-hexa",
                    here
                      ? "bg-brand-soft text-brand-cta-foreground"
                      : done
                        ? "bg-sage text-sage-foreground"
                        : "bg-card text-faint shadow-[inset_0_0_0_1px_var(--input)]"
                  )}
                >
                  {done ? <CheckIcon className="size-3.5" strokeWidth={2.4} /> : i + 1}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className={cn("block text-ui-sm", here ? "font-black text-foreground" : open ? "font-bold text-body" : "font-bold text-faint")}>{s.title}</span>
                  {s.hint && <span className="mt-0.5 block text-caption text-faint">{s.hint}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Two-column shell for a stepped dialog: `rail` on a band at left, the scrolling step body at right. */
function StepperLayout({ rail, children, className, ...props }: React.ComponentProps<"div"> & { rail: React.ReactNode }) {
  return (
    <div data-slot="stepper-layout" className={cn("grid max-h-[90vh] grid-cols-1 sm:grid-cols-[206px_minmax(0,1fr)]", className)} {...props}>
      <aside className="border-b border-divider bg-surface-band p-5 sm:border-r sm:border-b-0 sm:p-6">{rail}</aside>
      <div className="min-w-0 overflow-y-auto px-6 pt-6 pb-5 sm:px-7">{children}</div>
    </div>
  )
}

/** Footer row for a step body: a note that takes the free space, then the actions. */
function StepperFooter({ note, children, className, ...props }: React.ComponentProps<"div"> & { note?: React.ReactNode }) {
  return (
    <div data-slot="stepper-footer" className={cn("mt-6 flex flex-wrap items-center gap-2 border-t border-divider pt-[18px]", className)} {...props}>
      <span className="min-w-[150px] flex-1 text-caption leading-[1.5] text-pretty text-faint">{note}</span>
      {children}
    </div>
  )
}

export { Stepper, StepperLayout, StepperFooter }
