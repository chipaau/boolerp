import { Link, useMatch } from '@tanstack/react-router'
import { Button } from '@workspace/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { cn } from '@workspace/ui/lib/utils'
import { AppIcon } from '@/components/app-icon'
import { APPS } from '@/lib/apps'

/**
 * The 3×3-dots button in the topbar and its apps grid (icon plate + name, the current app in
 * amber), with "Browse all apps" underneath, as in the design.
 */
export function AppSwitcher() {
  const match = useMatch({ from: '/_app/$app', shouldThrow: false })
  const current = match?.params.app
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-[34px] hover:bg-sidebar-hover data-open:bg-sidebar-hover"
            aria-label="Switch app"
            title="Switch app"
          />
        }
      >
        <span aria-hidden="true" className="grid grid-cols-3 gap-[3.5px]">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="size-[3px] rounded-full bg-faint" />
          ))}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[292px] p-2">
        <div className="px-2 pt-1 pb-2.5 text-overline text-faint">Apps</div>
        <div className="grid grid-cols-3 gap-1">
          {APPS.map((app) => {
            const active = app.slug === current
            return (
              <Link
                key={app.slug}
                to="/$app"
                params={{ app: app.slug }}
                className="flex flex-col items-center gap-[7px] rounded-[10px] px-1.5 py-3 outline-none transition-colors duration-instant ease-hexa hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-[34px] place-items-center rounded-[10px] bg-surface-soft">
                  <AppIcon slug={app.slug} size={22} />
                </span>
                <span className={cn('text-center text-[11.5px] leading-tight', active ? 'font-bold text-tone-warning-deep' : 'font-medium text-body')}>
                  {app.name}
                </span>
              </Link>
            )
          })}
        </div>
        <div className="mt-2 border-t border-divider pt-2.5 text-center">
          <Button variant="link" size="xs" className="text-[12.5px] no-underline hover:underline" render={<Link to="/" />}>
            Browse all apps
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
