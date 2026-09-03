import { useMatch } from '@tanstack/react-router'
import { Bell, ChevronDown } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { SearchField } from '@workspace/ui/components/search-field'
import { SidebarTrigger } from '@workspace/ui/components/sidebar'
import { getApp } from '@/lib/apps'
import { AppSwitcher } from './app-switcher'
import { BrandMark } from './brand-mark'
import { UserMenu } from './nav-user'

/**
 * The global topbar, identical in every app: brand mark, the search pill in the middle, the bell
 * and the avatar on the right (the design's four elements; the theme switch lives in the account
 * menu). Inside an app it adds a hairline, the app name, which opens the app switcher, and the
 * sidebar toggle.
 */
export function SiteHeader() {
  const match = useMatch({ from: '/_app/$app', shouldThrow: false })
  const app = match ? getApp(match.params.app) : undefined
  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) w-full items-center gap-5 border-b border-border bg-card px-[22px]">
      <BrandMark />
      {app && (
        <>
          <span aria-hidden="true" className="h-[26px] w-px bg-border" />
          <AppSwitcher
            render={
              <button
                type="button"
                aria-label={`${app.name}. Switch app`}
                className="group inline-flex items-center gap-1.5 rounded-md text-[15px] font-bold text-body outline-none transition-colors duration-instant ease-hexa hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card data-open:text-foreground"
              />
            }
          >
            {app.name}
            <ChevronDown
              className="size-3.5 text-faint transition-transform duration-instant ease-hexa group-data-open:rotate-180"
              strokeWidth={2}
            />
          </AppSwitcher>
          <SidebarTrigger className="-ms-2 text-muted-foreground" />
        </>
      )}

      <div className="mx-auto hidden w-full max-w-[400px] md:block">
        <SearchField asButton placeholder="Search apps, files, people…" shortcut="⌘K" />
      </div>

      <div className="ms-auto flex items-center gap-2">
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
