import type { ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'

// Same PageHeader/PageTitle building blocks as apps/app's, so every screen (tenant app or operator
// console) measures the same.
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-8 py-5">
      <div>
        <h1 className="text-h1 leading-[1.3] text-foreground">{title}</h1>
        {description && <p className="text-caption text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

export function PageTitle({
  overline,
  title,
  meta,
  actions,
  className,
}: {
  overline?: ReactNode
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-[34px] flex flex-wrap items-end justify-between gap-6', className)}>
      <div className="min-w-0 flex-1 basis-[300px]">
        {overline && <div className="mb-2 text-overline text-faint">{overline}</div>}
        <h1 className="text-[30px] leading-none font-medium tracking-[-0.022em] text-foreground">{title}</h1>
        {meta && <div className="mt-2.5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">{meta}</div>}
      </div>
      {actions && <div className="ms-auto flex items-center gap-2.5">{actions}</div>}
    </div>
  )
}
