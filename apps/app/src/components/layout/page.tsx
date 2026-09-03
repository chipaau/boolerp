import type { ReactNode } from 'react'

// Shared page header: Heading 1 title, caption description, one hairline below. Used by proto
// and real pages alike so every screen measures the same.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
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
