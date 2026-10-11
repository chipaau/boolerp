import type { ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'

const TONE = {
  info: { box: 'bg-info-bg text-info-fg', dot: 'bg-[var(--tint-lilac-fg)]' },
  warning: { box: 'bg-warning-bg text-warning-fg', dot: 'bg-warning-dot' },
  offer: { box: 'bg-indigo-900 text-white rounded-3xl shadow-banner', dot: 'bg-rose-400' },
  neutral: { box: 'glass text-ink-700', dot: 'bg-ink-500' },
  success: { box: 'bg-success-bg text-success-fg', dot: 'bg-success-fg' },
} as const

/** A one-line message with an optional action; the dark offer banner is the only heavy shadow. */
export function Banner({
  tone = 'info',
  title,
  children,
  action,
  dot = true,
  className,
}: {
  tone?: keyof typeof TONE
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  dot?: boolean
  className?: string
}) {
  const t = TONE[tone]
  return (
    <div
      role="status"
      className={cn('flex flex-wrap items-center gap-3 rounded-2xl text-[13px] leading-[1.45]', action ? 'py-2.5 pr-2.5 pl-[18px]' : 'px-[18px] py-3', t.box, className)}
    >
      {dot && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', t.dot)} />}
      <span className="min-w-0 flex-[1_1_240px]">
        {title && <b className="font-semibold">{title} </b>}
        {children}
      </span>
      {action}
    </div>
  )
}
