import type { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'

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
    <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

// Placeholder body for the shell/navigation slice — real module screens land with their components.
export function PlaceholderContent({ label }: { label: string }) {
  return (
    <div className="p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-base">Metric {i}</CardTitle>
              <CardDescription>{label}</CardDescription>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        {label} — coming soon.
      </div>
    </div>
  )
}
