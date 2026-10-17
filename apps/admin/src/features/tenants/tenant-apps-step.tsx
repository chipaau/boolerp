import { useMutation, useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { cn } from '@workspace/ui/lib/utils'
import { tenantMutations, tenantQueries } from './api'
import type { Tenant, TenantApp } from './schemas'

/**
 * The wizard's step 3 for a tenant just created (C224): its apps, whole apps only. The default apps
 * are shown as included, already on since creating the tenant turned them on (C204), and are not
 * changed here (the details page turns one off); every other app is a switch, saved at once. Apps
 * coming soon (C225) are listed after them, their switch disabled.
 */
export function TenantAppsStep({ tenant }: { tenant: Tenant }) {
  const apps = useQuery(tenantQueries.apps(tenant.id))
  const setApp = useMutation(tenantMutations.setApp(tenant.id))

  if (apps.isPending) return <p className="text-compact text-faint">Loading apps…</p>
  if (apps.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-compact text-body">The apps could not be loaded.</p>
        <Button variant="outline" size="sm" onClick={() => void apps.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const included = apps.data.items.filter((a) => a.isDefault && a.on)
  const others = apps.data.items.filter((a) => !(a.isDefault && a.on))
  // The app being switched, until its answer and the refetch are in.
  const busy = setApp.isPending ? setApp.variables.key : null

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-overline text-faint">Included with every tenant</div>
      {included.map((a) => (
        <div key={a.key} className="flex items-center gap-3 rounded-[13px] bg-surface-band px-4 py-3.5">
          <Lock className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
          <AppText app={a} />
          <Badge variant="success" size="sm">
            Included
          </Badge>
        </div>
      ))}

      <div className="mt-3 text-overline text-faint">Other apps</div>
      {others.length === 0 && <p className="text-compact text-faint">No other apps yet: every app there is comes with every tenant.</p>}
      {others.map((a) => (
        <label
          key={a.key}
          className={cn(
            'flex items-center gap-3 rounded-[13px] bg-card p-3.5',
            a.isAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70',
            a.on ? 'shadow-[inset_0_0_0_1px_var(--sage)]' : 'shadow-[inset_0_0_0_1px_var(--input)]'
          )}
        >
          <Checkbox
            checked={a.on}
            disabled={busy !== null || !a.isAvailable}
            onCheckedChange={(on) => setApp.mutate({ key: a.key, on: Boolean(on) })}
            aria-label={a.name}
          />
          <AppText app={a} />
          <Badge variant={a.on ? 'secondary' : 'neutral'} size="sm">
            {busy === a.key ? 'Saving…' : !a.isAvailable && !a.on ? 'Coming soon' : a.on ? 'On' : 'Off'}
          </Badge>
        </label>
      ))}
    </div>
  )
}

function AppText({ app }: { app: TenantApp }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-ui-sm font-black text-foreground">{app.name}</span>
      {app.description && <span className="mt-0.5 block text-caption text-faint">{app.description}</span>}
    </span>
  )
}

/** The review step's lines for a tenant's apps (C224): each app it has on. */
export function useTenantAppLines(tenant: Tenant | null): [string, string][] {
  const apps = useQuery({ ...tenantQueries.apps(tenant?.id ?? ''), enabled: tenant !== null })
  return (apps.data?.items ?? []).filter((a) => a.on).map((a) => [a.name, a.isDefault ? 'Included' : 'On'])
}
