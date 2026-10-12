import Link from 'next/link'
import type { ComponentProps } from 'react'
import { cn } from '@workspace/ui/lib/utils'

const slotClass = (selected?: boolean, disabled?: boolean) =>
  cn(
    'inline-flex h-8 shrink-0 items-center rounded-full px-[13px] text-[12.5px] font-medium tabular-nums no-underline transition-[background-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
    selected ? 'bg-indigo-900 text-white' : disabled ? 'cursor-default text-ink-300 line-through' : 'cursor-pointer text-ink-900 shadow-outline hover:bg-white hover-outline',
  )

/** A bookable time. Taken times stay visible, struck through, so the day's shape reads at a glance. */
export function TimeSlot({
  time,
  selected,
  disabled,
  href,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'children'> & { time: string; selected?: boolean; href?: string }) {
  if (href && !disabled)
    return (
      <Link href={href} className={cn(slotClass(selected), className)}>
        {time}
      </Link>
    )
  return (
    <button type="button" disabled={disabled} aria-pressed={!!selected} className={cn(slotClass(selected, disabled), className)} {...props}>
      {time}
    </button>
  )
}
