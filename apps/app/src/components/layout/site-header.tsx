import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Separator } from '@workspace/ui/components/separator'
import { SidebarTrigger } from '@workspace/ui/components/sidebar'
import { DEFAULT_APP } from '@/lib/apps'
import { AppSwitcher } from './app-switcher'
import { ModeToggle } from './mode-toggle'

export function SiteHeader() {
  return (
    <header className="bg-background sticky top-0 z-50 flex h-14 w-full items-center gap-2 border-b px-3">
      <SidebarTrigger className="-ms-1" />
      <Separator orientation="vertical" className="me-1 h-5" />
      <Link to="/$app" params={{ app: DEFAULT_APP }} className="font-semibold tracking-tight">
        Bool<span className="text-muted-foreground"> ERP</span>
      </Link>
      <div className="ms-auto flex items-center gap-2">
        <ModeToggle />
        <AppSwitcher />
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
      </div>
    </header>
  )
}
