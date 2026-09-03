import { AppSwitcher } from './app-switcher'
import { BrandMark } from './brand-mark'
import { CommandPalette } from './command-palette'
import { UserMenu } from './nav-user'
import { NotificationsMenu } from './notifications-menu'
import { TenantMenu } from './tenant-menu'
import { ThemeToggle } from './theme-toggle'

/**
 * The global topbar from the design, identical on Home and in every app: brand mark, the search
 * pill in the middle column, then theme, workspace, apps, a hairline, notifications and the
 * account avatar. The app identifies itself at the top of its rail.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 grid h-(--header-height) w-full grid-cols-[minmax(min-content,1fr)_minmax(150px,340px)_minmax(min-content,1fr)] items-center gap-[18px] border-b border-border bg-card px-6">
      <div className="flex min-w-0 items-center gap-[18px] overflow-hidden">
        <BrandMark />
      </div>

      <CommandPalette />

      <div className="flex items-center justify-end gap-2 justify-self-end">
        <ThemeToggle />
        <TenantMenu />
        <AppSwitcher />
        <span aria-hidden="true" className="mx-1 h-[22px] w-px bg-border" />
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  )
}
