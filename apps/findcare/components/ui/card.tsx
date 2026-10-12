import type { ComponentProps } from 'react'
import { cn } from '@workspace/ui/lib/utils'

/**
 * A frosted-glass surface. Radii by role: 20 list rows (default), 22 profile and hero cards, 16
 * banners and inner panels. Interactive cards brighten on hover; nothing lifts or scales.
 */
export function Card({ interactive, className, ...props }: ComponentProps<'div'> & { interactive?: boolean }) {
  return <div className={cn('glass rounded-[20px] px-5 py-[18px] text-ink-900', interactive && 'cursor-pointer transition-colors hover-glass', className)} {...props} />
}

/** An inner panel: a 3.5% ink wash, no shadow. */
export function Panel({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-2xl bg-wash-1 px-4 py-3.5', className)} {...props} />
}
