import { Link } from '@tanstack/react-router'
import { Button } from '@workspace/ui/components/button'
import { AppSwitcherMenu } from '@workspace/ui/components/workspace-header'
import { AppIcon } from '@/components/app-icon'
import { APPS, useCurrentApp } from '@/lib/apps'

/** The shared apps grid fed with the workspace apps (current one in amber), plus "Browse all apps". */
export function AppSwitcher() {
  const current = useCurrentApp()?.slug
  return (
    <AppSwitcherMenu
      items={APPS.map((app) => ({
        key: app.slug,
        name: app.name,
        icon: <AppIcon slug={app.slug} size={22} />,
        render: <Link to="/$app" params={{ app: app.slug }} />,
        active: app.slug === current,
      }))}
      footer={
        <Button variant="link" size="xs" className="text-meta no-underline hover:underline" render={<Link to="/" />}>
          Browse all apps
        </Button>
      }
    />
  )
}
