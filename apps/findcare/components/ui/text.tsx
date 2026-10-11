import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'

/** The tracked uppercase micro-label above a title or section. */
export function Overline({ size = 'md', className, ...props }: ComponentProps<'div'> & { size?: 'md' | 'lg' }) {
  return <div className={cn('eyebrow text-ink-500', size === 'lg' && 'text-[10.5px] tracking-[0.24em]', className)} {...props} />
}

/** A labelled fact: the value, with its label under it. */
export function FactTile({ label, value, size = 'md', className }: { label: string; value: ReactNode; size?: 'md' | 'lg'; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-xl bg-wash-1 px-3 py-2.5', className)}>
      <div className={cn('truncate leading-[1.2] font-semibold text-ink-900', size === 'lg' ? 'text-[14px]' : 'text-[13.5px]')}>{value}</div>
      <div className="mt-0.5 text-[9.5px] font-medium tracking-[0.18em] text-ink-500 uppercase">{label}</div>
    </div>
  )
}

/** A small status dot (unread, offer, payment). */
export function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block size-[7px] shrink-0 rounded-full bg-rose-400', className)} />
}

/** A page's title block: overline, heading and an optional line under it. */
export function PageTitle({ overline, title, sub, actions }: { overline?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {overline && <Overline size="lg">{overline}</Overline>}
        <h1 className="mt-3.5 text-[34px] leading-[1.05] font-semibold tracking-[-0.025em] text-ink-900">{title}</h1>
        {sub && <p className="mt-2 text-[14px] leading-[1.55] text-ink-600">{sub}</p>}
      </div>
      {actions}
    </div>
  )
}
