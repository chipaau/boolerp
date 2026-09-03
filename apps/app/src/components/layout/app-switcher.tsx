import { Link } from '@tanstack/react-router'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { AppIcon } from '@/components/app-icon'
import { APPS } from '@/lib/apps'

// Grip-style app switcher: a list of apps, each linking to its home.
export function AppSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Open app switcher" className="text-muted-foreground" />}
      >
        <LayoutGrid className="size-[18px]" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px] p-0">
        <div className="px-4 py-4">
          <div className="mb-3 text-overline text-faint">Apps</div>
          <div className="flex flex-col gap-0.5">
            {APPS.map((app) => (
              <Link
                key={app.slug}
                to="/$app"
                params={{ app: app.slug }}
                className="flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors duration-instant ease-hexa hover:bg-accent"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-muted">
                  <AppIcon slug={app.slug} size={20} />
                </span>
                <div className="flex min-w-0 flex-col text-left">
                  <span className="truncate text-sm font-bold text-foreground">{app.name}</span>
                  <span className="truncate text-xs leading-tight text-muted-foreground">
                    {app.description}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
