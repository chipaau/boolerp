import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Label } from '@workspace/ui/components/label'
import { cn } from '@workspace/ui/lib/utils'
import { MODE_TONE, ROLE_TONE, STATUS_TONE } from '@workspace/org/logic'
import { useOrgMe } from '@workspace/org/queries'
import type { PersonRole, PersonStatus, StorageMode } from '@workspace/org/types'

export type Section = 'units' | 'employees' | 'site-types' | 'sites' | 'codes' | 'regions' | 'holidays' | 'notifications' | 'activity'

/** Staff browse Control Centre but change nothing; Managers edit people and sites; Admins everything. */
export function useCanEdit() {
  return useOrgMe().role !== 'Staff'
}
export function useIsAdmin() {
  return useOrgMe().role === 'Admin'
}

/** The title block every Control Centre screen opens with. */
export function ControlTitle({ overline, title, description, actions, back }: { overline?: string; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: { to: Section; label: string } }) {
  return (
    <div className="mb-5">
      {back && (
        <Button variant="link" size="xs" render={<Link to="/$app/$section" params={{ app: 'control-centre', section: back.to }} />} className="mb-3.5 text-compact">
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
          {back.label}
        </Button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-[300px]">
          {overline && <div className="mb-2 text-overline text-faint">{overline}</div>}
          <h1 className="text-[30px] leading-none font-medium tracking-[-0.022em] text-foreground">{title}</h1>
          {description && <div className="mt-2.5 max-w-[66ch] text-ui-sm leading-[1.6] text-pretty text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="ms-auto flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </div>
  )
}

/** One line of facts under a title: "24 units · 88 people placed · every unit has someone in it". */
export function RuleStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-5 rounded-xl border border-border bg-surface-band px-4 py-[11px] text-compact leading-[1.5] text-body', className)}>{children}</div>
}

/** A card with an overline heading and an optional action at its right. */
export function Panel({ heading, aside, children, className, bodyClassName }: { heading?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      {(heading || aside) && (
        <div className="flex items-baseline justify-between gap-3 px-[22px] pt-5">
          <div className="text-overline text-faint">{heading}</div>
          {aside}
        </div>
      )}
      <div className={cn('px-[22px] pt-3 pb-5', bodyClassName)}>{children}</div>
    </Card>
  )
}

export function KeyValue({ rows }: { rows: { k: string; v: React.ReactNode; mono?: boolean; quiet?: boolean }[] }) {
  return (
    <dl>
      {rows.map((r) => (
        <div key={r.k} className="flex items-baseline justify-between gap-4 border-b border-divider py-[9px] last:border-b-0">
          <dt className="shrink-0 text-compact text-faint">{r.k}</dt>
          <dd className={cn('text-right text-ui-sm font-medium text-body', r.mono && 'font-mono text-compact', r.quiet && 'text-faint')}>{r.v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Dots down a line: recent changes, a site's movement, a record's history. */
export function Timeline({ items, accent = 'sage' }: { items: { text: React.ReactNode; when: React.ReactNode }[]; accent?: 'sage' | 'amber' }) {
  if (!items.length) return null
  return (
    <ol>
      {items.map((it, i) => (
        <li key={i} className="flex min-h-[42px] items-stretch gap-[13px]">
          <span className="flex w-[9px] shrink-0 flex-col items-center">
            <span className={cn('mt-[5px] size-[9px] shrink-0 rounded-full', i === 0 ? (accent === 'amber' ? 'bg-brand-soft' : 'bg-sage') : 'bg-card shadow-[inset_0_0_0_1.5px_var(--divider)]')} />
            {i < items.length - 1 && <span className="mt-1 w-px flex-1 bg-divider" />}
          </span>
          <span className={cn('min-w-0 flex-1', i < items.length - 1 && 'pb-4')}>
            <span className="block text-ui-sm leading-[1.45] text-body">{it.text}</span>
            <span className="mt-[3px] block text-caption text-faint">{it.when}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export const StatusBadge = ({ status }: { status: PersonStatus }) => (
  <Badge variant={STATUS_TONE[status]} size="sm">
    {status}
  </Badge>
)
export const RoleBadge = ({ role }: { role: PersonRole }) => (
  <Badge variant={ROLE_TONE[role]} size="sm">
    {role}
  </Badge>
)
export const ModeBadge = ({ mode }: { mode: StorageMode }) => (
  <Badge variant={MODE_TONE[mode]} size="sm">
    {mode}
  </Badge>
)
export const YesNo = ({ on, yes, no }: { on: boolean; yes: string; no: string }) => (
  <Badge variant={on ? 'success' : 'outline'} size="sm">
    {on ? yes : no}
  </Badge>
)

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <Label className="mb-1.5 text-meta font-bold text-muted-foreground">
      {children}
      {hint && <span className="font-normal text-faint">{hint}</span>}
    </Label>
  )
}
export const fieldClass = 'h-10 w-full rounded-[10px] bg-surface-band px-[13px] text-sm text-foreground outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring'
