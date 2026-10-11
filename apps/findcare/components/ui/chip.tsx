import type { ComponentProps } from 'react'
import { cn } from '@workspace/ui/lib/utils'

/** A filter or choice pill; selected is solid indigo. */
export function Chip({ selected, size = 'md', className, type = 'button', ...props }: ComponentProps<'button'> & { selected?: boolean; size?: 'sm' | 'md' }) {
  return (
    <button
      type={type}
      aria-pressed={!!selected}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-default disabled:opacity-50',
        size === 'sm' ? 'h-8' : 'h-9',
        selected ? 'bg-indigo-900 text-white' : 'bg-white text-ink-900 shadow-[inset_0_0_0_1px_var(--line-3)] hover-outline',
        className,
      )}
      {...props}
    />
  )
}
