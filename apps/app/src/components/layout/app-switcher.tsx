import { Link } from '@tanstack/react-router'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { APPS } from '@/lib/apps'

// Grip-style app switcher (mirrors the workspace design): a grid of apps, each linking to its home.
export function AppSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open app switcher" className="border">
          <LayoutGrid className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px] p-0">
        <div className="px-4 py-4">
          <div className="mb-3 text-xs font-semibold text-muted-foreground">Apps</div>
          <div className="flex flex-col gap-1">
            {APPS.map((app) => (
              <Link
                key={app.slug}
                to="/$app"
                params={{ app: app.slug }}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
                  <app.icon className="size-4.5" />
                </div>
                <div className="flex min-w-0 flex-col text-left">
                  <span className="truncate text-sm font-semibold text-foreground">{app.name}</span>
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
