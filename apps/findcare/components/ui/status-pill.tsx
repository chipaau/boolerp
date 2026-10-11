import type { ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'

const TONE = {
  confirmed: 'bg-success-bg text-success-fg',
  waiting: 'bg-info-bg text-[var(--tint-lilac-fg)]',
  attention: 'bg-[var(--tint-butter-bg)] text-[var(--tint-butter-fg)]',
  danger: 'bg-danger-bg text-danger',
  muted: 'bg-line-1 text-ink-600',
} as const

export type StatusTone = keyof typeof TONE

/** A status in words; colour backs it up, never carries it alone. */
export function StatusPill({ tone = 'confirmed', children, className }: { tone?: StatusTone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex h-[22px] items-center rounded-full px-[9px] text-[11px] font-medium whitespace-nowrap', TONE[tone], className)}>{children}</span>
}
