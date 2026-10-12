'use client'

import Link from 'next/link'
import { useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import type { Tint } from '@/lib/data'
import { Avatar } from './avatar'
import { TimeSlot } from './time-slot'

/**
 * A doctor or service at one branch, as listings show it: who, where and the fee on top, then the
 * day of the next opening and its first few times. Every time leads to the same booking page,
 * which opens on that day; the card only previews them. With `expandable`, the times beyond `max`
 * fold behind a "+N" pill instead of being dropped.
 */
export function ListingCard({
  name,
  sub,
  initials,
  tint,
  href,
  fee,
  payTag,
  day,
  times,
  max = 3,
  expandable = false,
  avatarSize = 48,
  className,
}: {
  name: string
  sub: string
  initials: string
  tint: Tint
  href: string
  fee?: string
  payTag?: string
  /** "Today", "Tue 14 Oct", or why there is nothing to show. */
  day: string
  times: string[]
  max?: number
  expandable?: boolean
  avatarSize?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const shown = open ? times : times.slice(0, max)
  const extra = times.length - max
  return (
    <div className={cn('glass flex flex-col gap-4 rounded-[20px] p-[22px] text-ink-900', className)}>
      <Link href={href} className="flex items-center gap-3.5 text-ink-900 no-underline hover:text-ink-900">
        <Avatar initials={initials} tint={tint} size={avatarSize} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{name}</div>
          <div className="mt-1 truncate text-[12.5px] text-ink-600">{sub}</div>
        </div>
        {(fee || payTag) && (
          <span className="flex shrink-0 flex-col items-end gap-[3px] self-start">
            {fee && <span className="text-[12px] font-medium text-ink-600 tabular-nums">{fee}</span>}
            {payTag && <span className="text-[11px] whitespace-nowrap text-ink-500">{payTag}</span>}
          </span>
        )}
      </Link>
      <div className={cn('flex items-center gap-2 overflow-hidden pt-4 shadow-[inset_0_1px_0_var(--line-2)]', open ? 'flex-wrap' : 'flex-nowrap')}>
        <span className="mr-1.5 shrink-0 text-[10px] font-medium tracking-[0.2em] text-ink-500 uppercase">{day}</span>
        {shown.map((t) => (
          <TimeSlot key={t} time={t} href={href} />
        ))}
        {expandable && extra > 0 && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? 'Show fewer times' : `Show ${extra} more times`}
            className="h-8 min-w-10 shrink-0 cursor-pointer rounded-full bg-wash-2 px-[11px] text-[12.5px] font-medium text-ink-700 tabular-nums transition-colors outline-none hover-ghost hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {open ? 'Less' : `+${extra}`}
          </button>
        )}
      </div>
    </div>
  )
}
