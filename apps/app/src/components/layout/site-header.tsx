import { useMatch } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { SearchField } from '@workspace/ui/components/search-field'
import { SidebarTrigger } from '@workspace/ui/components/sidebar'
import { getApp } from '@/lib/apps'
import { AppSwitcher } from './app-switcher'
import { BrandMark } from './brand-mark'
import { ModeToggle } from './mode-toggle'
import { UserMenu } from './nav-user'

// The global topbar is identical in every app: that is what tells a user they never left the
// workspace. Inside an app it adds the app name after a hairline and the sidebar toggle.
export function SiteHeader() {
  const match = useMatch({ from: '/_app/$app', shouldThrow: false })
  const app = match ? getApp(match.params.app) : undefined
  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) w-full items-center gap-5 border-b border-border bg-card px-[22px]">
      <BrandMark />
      {app && (
        <>
          <span aria-hidden="true" className="h-[26px] w-px bg-border" />
          <span className="text-[15px] font-bold text-body">{app.name}</span>
          <SidebarTrigger className="-ms-2 text-muted-foreground" />
        </>
      )}

      <div className="mx-auto hidden w-full max-w-[400px] md:block">
        <SearchField asButton placeholder="Search apps, files, people…" shortcut="⌘K" />
      </div>

      <div className="ms-auto flex items-center gap-2">
        <ModeToggle />
        <AppSwitcher />
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative text-muted-foreground">
          <Bell className="size-[18px]" strokeWidth={1.75} />
          <span
            aria-hidden="true"
            className="absolute top-2 right-2.5 size-[7px] rounded-full bg-destructive ring-2 ring-card"
          />
        </Button>
        <UserMenu />
      </div>
    </header>
  )
}
