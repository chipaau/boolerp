import type { ReactNode } from 'react'
import type { BadgeTone } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@workspace/ui/components/sheet'
import { cn } from '@workspace/ui/lib/utils'
import type { LedgerStatus } from '@/features/billing/types'
import type { DirectoryStatus, InviteState } from './types'

// Small building blocks shared by the tenant detail tabs and its drawers.

export const STATUS_TONE: Record<DirectoryStatus, BadgeTone> = {
  active: 'success',
  suspended: 'warning',
  archived: 'danger',
  provisioning: 'slate',
  pending: 'slate',
  draft: 'neutral',
}

export const INVITE_TONE: Record<InviteState, BadgeTone> = { Accepted: 'success', Invited: 'slate', Expired: 'warning' }

export const LEDGER_TONE: Record<LedgerStatus, BadgeTone> = {
  Paid: 'success',
  Overdue: 'warning',
  Draft: 'neutral',
  Due: 'slate',
  Credited: 'tan',
  Refunded: 'tan',
}

export const initials = (name: string) =>
  (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

/** Uppercase overline label used as every card heading. */
export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-overline text-faint', className)}>{children}</div>
}

/** A text action that sits at the right of a card heading ("Edit", "See all"). */
export function LinkAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button variant="link" size="sm" onClick={onClick} className="text-compact font-bold">
      {children}
    </Button>
  )
}

/** Card with an overline heading and an optional action. */
export function DetailCard({ heading, aside, children, className }: { heading?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('gap-0 px-6 py-[22px]', className)}>
      {(heading || aside) && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <Overline>{heading}</Overline>
          {aside}
        </div>
      )}
      {children}
    </Card>
  )
}

/** Label / value rows, divided. */
export function KeyValueRows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(100px,0.7fr)_minmax(0,1.4fr)] gap-4 border-b border-divider py-2.5 last:border-b-0">
          <span className="text-compact text-muted-foreground">{r.label}</span>
          <span className="text-ui-sm font-bold text-body">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/** The design's right-hand drawer: title, note, scrolling body, amber warning, Cancel + save. */
export function DrawerShell({
  open,
  title,
  note,
  warn,
  saveLabel,
  saveDisabled,
  onSave,
  onClose,
  children,
}: {
  open: boolean
  title: ReactNode
  note?: ReactNode
  warn?: ReactNode
  saveLabel: string
  saveDisabled?: boolean
  onSave: () => void
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[560px]">
        <SheetHeader className="border-b border-divider px-7 pt-6 pb-[18px]">
          <SheetTitle className="pr-8 text-h3">{title}</SheetTitle>
          {note && <SheetDescription className="text-compact leading-[1.5] text-muted-foreground">{note}</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-[22px] pb-[26px]">
          {children}
          {warn && (
            <div className="mt-[22px] flex items-start gap-2.5 rounded-xl border border-divider bg-surface-band px-[15px] py-[13px]">
              <span aria-hidden="true" className="mt-1.5 size-[7px] shrink-0 rounded-full bg-tone-warning" />
              <span className="text-compact leading-[1.55] text-body">{warn}</span>
            </div>
          )}
        </div>
        <SheetFooter className="flex-row items-center justify-end gap-3.5 border-t border-divider px-7 py-4">
          <Button variant="link" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saveDisabled}>
            {saveLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/** A labelled drawer field: label, control, optional hint. */
export function DrawerField({ label, hint, wide, children }: { label: string; hint?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <label className={cn('block min-w-0', wide && 'col-span-full')}>
      <span className="mb-1.5 block text-fine font-bold tracking-[0.03em] text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-fine leading-[1.45] text-muted-foreground">{hint}</span>}
    </label>
  )
}

/** A radio card: title, note, selected state in sage. */
export function PickCard({ selected, title, note, onPick, dimmed, trailing }: { selected: boolean; title: ReactNode; note?: ReactNode; onPick: () => void; dimmed?: boolean; trailing?: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      className={cn(
        'block w-full rounded-[13px] border px-[15px] py-[13px] text-left transition-colors duration-instant ease-bool',
        selected ? 'border-sage bg-sage-soft' : 'border-divider hover:bg-surface-soft',
        dimmed && 'opacity-45',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-ui-sm font-bold text-foreground">{title}</span>
        {trailing}
        <Radio on={selected} />
      </div>
      {note && <div className="mt-[7px] text-fine leading-[1.45] text-muted-foreground">{note}</div>}
    </button>
  )
}

export function Radio({ on }: { on: boolean }) {
  return <span aria-hidden="true" className={cn('size-4 shrink-0 rounded-full', on ? 'shadow-[inset_0_0_0_5px_var(--sage)]' : 'shadow-[inset_0_0_0_1.5px_var(--border)]')} />
}

/** Seat usage bar; amber above 90%. */
export function SeatBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-surface-soft', className)}>
      <span className={cn('block h-full rounded-full', pct > 90 ? 'bg-tone-warning' : 'bg-sage')} style={{ width: `${Math.max(Math.min(pct, 100), 2)}%` }} />
    </div>
  )
}
