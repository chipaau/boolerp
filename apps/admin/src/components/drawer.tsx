import type { ReactNode } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@workspace/ui/components/sheet'
import { cn } from '@workspace/ui/lib/utils'

// The Bool Admin side drawer (design section DRAWER): a 560px right sheet with a title + note
// header, a scrolling body and a Cancel / primary footer. Wraps @workspace/ui's Sheet.

/** Right-hand form drawer: header, scrolling body, Cancel + save footer. */
export function Drawer({
  open,
  onClose,
  title,
  note,
  saveLabel,
  onSave,
  saveDisabled,
  children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  note?: ReactNode
  saveLabel: string
  onSave: () => void
  saveDisabled?: boolean
  children: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[560px]">
        <div className="border-b border-divider px-7 pt-6 pb-[18px] pe-16">
          <SheetTitle className="text-h3">{title}</SheetTitle>
          {note && <SheetDescription className="mt-1.5 text-caption leading-normal text-muted-foreground">{note}</SheetDescription>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-[22px] pb-[26px]">{children}</div>
        <div className="flex items-center justify-end gap-3.5 border-t border-divider px-7 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saveDisabled}>
            {saveLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Small faint field/section label used inside drawers. */
export function DrawerLabel({ children, className, htmlFor }: { children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-2 block text-fine font-bold tracking-[0.03em] text-muted-foreground', className)}>
      {children}
    </label>
  )
}

/** Two-column field grid; pass `wide` on a DrawerField to span both columns. */
export function DrawerGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-x-[18px] gap-y-4 sm:grid-cols-2', className)}>{children}</div>
}

/** Label + control + optional hint. */
export function DrawerField({ label, htmlFor, hint, wide, children }: { label: string; htmlFor: string; hint?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <DrawerLabel htmlFor={htmlFor}>{label}</DrawerLabel>
      {children}
      {hint && <p className="mt-1.5 text-fine leading-normal text-faint">{hint}</p>}
    </div>
  )
}

/** Selectable card with a radio dot (role pickers, plan pickers). */
export function DrawerChoice({ selected, onSelect, label, note }: { selected: boolean; onSelect: () => void; label: ReactNode; note?: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'rounded-lg p-3.5 text-left outline-none transition-[background-color,box-shadow] duration-instant ease-bool focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'bg-sage-soft shadow-[inset_0_0_0_1.5px_var(--sage)]' : 'bg-surface-band shadow-[inset_0_0_0_1px_var(--divider)] hover:bg-secondary-hover/60'
      )}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className={cn('grid size-3.5 place-items-center rounded-full', selected ? 'bg-sage' : 'shadow-[inset_0_0_0_1.5px_var(--input)]')}>
          {selected && <span className="size-1.5 rounded-full bg-card" />}
        </span>
        <span className="text-ui-sm font-bold text-foreground">{label}</span>
      </span>
      {note && <span className="mt-2 block text-fine leading-[1.45] text-muted-foreground">{note}</span>}
    </button>
  )
}

/** Amber-dot warning strip at the foot of a drawer body. */
export function DrawerWarning({ children }: { children: ReactNode }) {
  return (
    <div role="note" className="mt-[22px] flex items-start gap-2.5 rounded-lg bg-surface-band px-[15px] py-[13px] shadow-[inset_0_0_0_1px_var(--divider)]">
      <span aria-hidden="true" className="mt-1.5 size-[7px] shrink-0 rounded-full bg-tone-warning" />
      <span className="text-caption leading-[1.55] text-body">{children}</span>
    </div>
  )
}
