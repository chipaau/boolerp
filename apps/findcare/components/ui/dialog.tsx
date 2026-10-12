'use client'

import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Dialog as Root, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@workspace/ui/components/dialog'
import { cn } from '@workspace/ui/lib/utils'
import { Overline } from './text'

/**
 * A decision or a short form over the page: the shared Dialog (focus trap, Escape, scroll lock) as a
 * near-opaque white 24px panel, with an eyebrow kicker, a title and a close button.
 */
export function Dialog({
  open,
  onOpenChange,
  kicker,
  title,
  description,
  children,
  width = 460,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kicker?: ReactNode
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  width?: number
  className?: string
}) {
  return (
    <Root open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('flex max-h-[calc(100svh-2rem)] flex-col gap-[18px] overflow-y-auto rounded-3xl bg-white/97 p-6 text-ink-900 shadow-dialog sm:max-w-none', className)}
        style={{ width: `min(${width}px, calc(100% - 2rem))` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {kicker && <Overline>{kicker}</Overline>}
            <DialogTitle className={cn('text-[20px] leading-tight font-semibold', kicker && 'mt-1.5')}>{title}</DialogTitle>
            {description && <DialogDescription className="mt-1.5 text-[13px] leading-normal text-ink-600">{description}</DialogDescription>}
          </div>
          <DialogClose
            aria-label="Close"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-500 transition-colors outline-none hover-ghost hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X className="size-3.5" strokeWidth={1.8} />
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Root>
  )
}
