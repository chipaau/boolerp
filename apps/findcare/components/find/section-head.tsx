import Link from 'next/link'
import { cn } from '@workspace/ui/lib/utils'
import type { ReactNode } from 'react'
import { Overline } from '@/components/ui/text'

/** A section's eyebrow and title, with an optional tracked link on the right ("See all →"). */
export function SectionHead({ overline, title, link }: { overline: ReactNode; title: ReactNode; link?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Overline size="lg">{overline}</Overline>
        <h2 className="mt-2.5 text-[26px] leading-[1.1] font-semibold tracking-[-0.02em] text-ink-900">{title}</h2>
      </div>
      {link && (
        <Link href={link.href} className="cta-label whitespace-nowrap text-ink-900 no-underline hover:text-indigo-500">
          {link.label}
        </Link>
      )}
    </div>
  )
}

/** The quiet glass box a list shows when nothing matches. */
export function EmptyNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[20px] bg-glass p-7 text-center text-[14px] leading-normal text-ink-600 shadow-[inset_0_0_0_1px_rgba(255,255,255,.95)]', className)}>
      {children}
    </div>
  )
}
