import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import type { Tint } from '@/lib/data'

/** A glass panel with an eyebrow title and an optional link, holding rows. */
export function ListCard({ title, link, children, className }: { title: string; link?: { label: string; href: string }; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn('glass rounded-[20px] px-2 pt-4 pb-2', className)}>
      <div className="eyebrow flex items-center justify-between px-2.5 pb-2 text-ink-500">
        <h2 className="font-medium">{title}</h2>
        {link && (
          <Link href={link.href} className="tracking-[0.16em] text-indigo-500 no-underline hover:text-indigo-900">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/** One row: a leading mark (avatar or date tile), two lines, and something on the right. */
export function ListRow({ lead, title, sub, trailing, href }: { lead: ReactNode; title: ReactNode; sub: ReactNode; trailing?: ReactNode; href?: string }) {
  const body = (
    <>
      {lead}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink-900">{title}</span>
        <span className="mt-0.5 block truncate text-[11.5px] text-ink-500">{sub}</span>
      </span>
      {trailing}
    </>
  )
  const row = 'flex items-center gap-2.5 rounded-[14px] px-2.5 py-[9px] text-ink-900 no-underline'
  return href ? (
    <Link href={href} className={cn(row, 'hover-glass')}>
      {body}
    </Link>
  ) : (
    <div className={row}>{body}</div>
  )
}

export const RowAvatar = ({ initials, tint }: { initials: string; tint: Tint }) => <Avatar initials={initials} tint={tint} size={36} />

/** A date as a small tile: the day number over the month. */
export function DateTile({ date }: { date: string }) {
  const d = new Date(`${date}T00:00:00Z`)
  return (
    <span className="w-9 shrink-0 text-center">
      <span className="block text-[15px] leading-none font-semibold tabular-nums">{d.getUTCDate()}</span>
      <span className="mt-[3px] block text-[9px] font-medium tracking-[0.16em] text-ink-500 uppercase">{d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</span>
    </span>
  )
}
