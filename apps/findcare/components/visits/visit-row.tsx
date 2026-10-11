import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { StatusPill } from '@/components/ui/status-pill'
import type { VisitSummary } from './summary'

const ROW =
  'glass grid w-full cursor-pointer grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-[clamp(10px,3vw,18px)] rounded-[20px] py-3.5 pr-[clamp(12px,3vw,20px)] pl-3.5 text-left text-ink-900 no-underline transition-colors outline-none hover-glass focus-visible:ring-2 focus-visible:ring-indigo-500'

/**
 * One visit (or waitlist entry) as a list row: the date tile, the doctor and status, where, when and
 * for whom. It either expands a detail panel in place (onToggle, with aria-expanded) or links to one (href).
 */
export function VisitRow({
  summary: v,
  open,
  onToggle,
  controls,
  href,
  muted,
  trailing,
}: {
  summary: VisitSummary
  open?: boolean
  onToggle?: () => void
  /** The id of the panel this row opens. */
  controls?: string
  href?: string
  /** Past and ended visits sit back a little. */
  muted?: boolean
  /** Replaces the "Details" label at the end. */
  trailing?: ReactNode
}) {
  const body = (
    <>
      <span aria-hidden className="flex h-14 flex-col items-center justify-center rounded-[14px] bg-wash-1">
        <span className="text-[22px] leading-none font-semibold">{v.day}</span>
        <span className="mt-1 text-[9.5px] font-medium tracking-[0.2em] text-ink-500 uppercase">{v.month}</span>
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold">{v.title}</span>
          <StatusPill tone={v.status.tone}>{v.status.label}</StatusPill>
        </span>
        <span className="mt-1 block truncate text-[12.5px] text-ink-600">{v.sub}</span>
        <span className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] font-medium text-ink-700">
          <span>{v.when}</span>
          {v.who && <span className="text-ink-500">{v.who}</span>}
        </span>
      </span>
      <span className="text-[11px] font-medium tracking-[0.18em] whitespace-nowrap uppercase">{trailing ?? (href ? 'Details →' : open ? 'Close ↑' : 'Details ↓')}</span>
    </>
  )
  const cls = cn(ROW, muted && 'opacity-75')
  if (href)
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    )
  return (
    <button type="button" onClick={onToggle} aria-expanded={!!open} aria-controls={controls} className={cls}>
      {body}
    </button>
  )
}
