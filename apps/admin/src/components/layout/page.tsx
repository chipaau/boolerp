import type { ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'

// Same title block as apps/app's ControlTitle, so every screen (tenant app or operator console)
// measures the same.
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

/** The title block every console screen opens with: optional back link, overline, title, one line, actions. */
export function PageTitle({
  overline,
  title,
  meta,
  back,
  actions,
  className,
}: {
  overline?: ReactNode
  title: ReactNode
  /** The line under the title (ControlTitle's `description`). */
  meta?: ReactNode
  /** A link-style back control rendered above the overline. */
  back?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-5', className)}>
      {back}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-[300px]">
          {overline && <div className="mb-2 text-overline text-faint">{overline}</div>}
          <h1 className="text-[30px] leading-none font-medium tracking-[-0.022em] text-foreground">{title}</h1>
          {meta && <div className="mt-2.5 max-w-[96ch] text-ui-sm leading-[1.6] text-pretty text-muted-foreground">{meta}</div>}
        </div>
        {actions && <div className="ms-auto flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </div>
  )
}
