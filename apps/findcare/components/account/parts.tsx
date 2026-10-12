import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@workspace/ui/lib/utils'

/** The account page's frosted cards: 22px corners with a slightly wider shadow than list cards. */
export const ACCOUNT_CARD = 'glass rounded-[22px] text-ink-900 shadow-[inset_0_0_0_1px_rgba(255,255,255,.95),0_16px_40px_rgba(106,92,176,.08)]'

/** The outlined "Edit" pill beside the holder and each family member. */
export function EditButton({ className, ...props }: ComponentProps<'button'>) {
  return (
    <Button variant="ghost" size="sm" className={cn('shadow-[inset_0_0_0_1px_var(--line-4)] hover-outline', className)} {...props}>
      Edit
    </Button>
  )
}
