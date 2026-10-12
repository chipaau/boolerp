import type { ComponentProps } from 'react'
import { cn } from '@workspace/ui/lib/utils'

// A round button that is only an icon (or initials), so it always carries a label.

const VARIANT = {
  glass: 'bg-white/72 text-ink-700 shadow-[inset_0_0_0_1px_rgba(255,255,255,.9)] hover-glass',
  ghost: 'bg-transparent text-ink-500 hover-ghost hover:text-ink-900',
  solid: 'bg-indigo-900 text-white hover:bg-indigo-950',
  avatar: 'bg-indigo-900 text-white text-[13px] font-semibold shadow-avatar',
} as const

export function IconButton({
  label,
  variant = 'glass',
  size = 40,
  className,
  style,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { label: string; variant?: keyof typeof VARIANT; size?: number }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative flex shrink-0 cursor-pointer items-center justify-center rounded-full p-0 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        VARIANT[variant],
        className,
      )}
      style={{ width: size, height: size, ...style }}
      {...props}
    />
  )
}
