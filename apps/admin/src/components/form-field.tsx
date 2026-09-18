import type { ReactNode } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Label } from '@workspace/ui/components/label'
import { cn } from '@workspace/ui/lib/utils'

/** The filled text-field look shared by stepped dialogs (matches apps/app's Control Centre forms). */
export const fieldClass =
  'h-10 w-full rounded-[10px] bg-surface-band px-[13px] text-sm text-foreground outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60'

/** A labelled field: label (tied to `id`), the control, then an optional hint (tan when `warn`). */
export function Field({ id, label, hint, warn, className, children }: { id?: string; label: string; hint?: ReactNode; warn?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn('min-w-0', className)}>
      <Label htmlFor={id} className="mb-1.5 text-meta font-bold text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <div className={cn('mt-1.5 text-caption leading-[1.45]', warn ? 'text-tone-warning-foreground' : 'text-faint')}>{hint}</div>}
    </div>
  )
}

/** Step heading + lede for the body of a stepped dialog. */
export function StepHeading({ title, lede }: { title: string; lede: ReactNode }) {
  return (
    <div className="mb-5 pr-8">
      <h2 className="text-[21px] leading-tight font-bold tracking-[-0.015em] text-foreground">{title}</h2>
      <p className="mt-1.5 max-w-[58ch] text-compact leading-[1.55] text-pretty text-body">{lede}</p>
    </div>
  )
}

/** A bordered review card with an overline title, an Edit link and label/value lines. */
export function ReviewCard({ title, onEdit, lines }: { title: string; onEdit?: () => void; lines: [string, string][] }) {
  return (
    <div className="rounded-[13px] bg-card p-4 shadow-[inset_0_0_0_1px_var(--input)]">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-overline text-faint">{title}</span>
        {onEdit && (
          <Button variant="link" size="sm" onClick={onEdit} aria-label={`Edit ${title}`} className="text-caption font-bold">
            Edit
          </Button>
        )}
      </div>
      {lines.map(([k, v], i) => (
        <div key={`${k}-${i}`} className="flex flex-wrap items-baseline gap-3.5 border-b border-divider py-[7px] last:border-b-0">
          <span className="w-[128px] shrink-0 text-caption text-faint">{k}</span>
          <span className={cn('min-w-0 flex-1 text-compact font-bold text-pretty', /^(None|Not set|—)/.test(v) ? 'text-faint' : 'text-foreground')}>{v}</span>
        </div>
      ))}
    </div>
  )
}
