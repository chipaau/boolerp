import type { ReactNode } from 'react'
import { Card } from '@workspace/ui/components/card'
import { cn } from '@workspace/ui/lib/utils'

// Panel and Timeline, the same idioms as apps/app's control-bits (copied, not imported).

/** A card with an overline heading and an optional action at its right. */
export function Panel({ heading, aside, children, className, bodyClassName }: { heading?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      {(heading || aside) && (
        <div className="flex items-baseline justify-between gap-3 px-[22px] pt-5">
          <div className="text-overline text-faint">{heading}</div>
          {aside}
        </div>
      )}
      <div className={cn('px-[22px] pt-3 pb-5', bodyClassName)}>{children}</div>
    </Card>
  )
}

/** Dots down a line: recent changes across tenants, a record's history. */
export function Timeline({ items }: { items: { text: ReactNode; when: ReactNode }[] }) {
  if (!items.length) return null
  return (
    <ol>
      {items.map((it, i) => (
        <li key={i} className="flex min-h-[42px] items-stretch gap-[13px]">
          <span className="flex w-[9px] shrink-0 flex-col items-center">
            <span className={cn('mt-[5px] size-[9px] shrink-0 rounded-full', i === 0 ? 'bg-sage' : 'bg-card shadow-[inset_0_0_0_1.5px_var(--divider)]')} />
            {i < items.length - 1 && <span className="mt-1 w-px flex-1 bg-divider" />}
          </span>
          <span className={cn('min-w-0 flex-1', i < items.length - 1 && 'pb-4')}>
            <span className="block text-ui-sm leading-[1.45] text-body">{it.text}</span>
            <span className="mt-[3px] block text-caption text-faint">{it.when}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
