import { useMatch } from '@tanstack/react-router'
import { SearchField } from '@workspace/ui/components/search-field'
import { SidebarTrigger } from '@workspace/ui/components/sidebar'
import { getApp } from '@/lib/apps'
import { AppSwitcher } from './app-switcher'
import { BrandMark } from './brand-mark'
import { UserMenu } from './nav-user'
import { NotificationsMenu } from './notifications-menu'
import { TenantMenu } from './tenant-menu'
import { ThemeToggle } from './theme-toggle'

/**
 * The global topbar from the design, identical in every app: brand mark (and the app name after
 * a hairline when inside one), the search pill in the middle column, then theme, workspace,
 * apps, a hairline, notifications and the account avatar.
 */
export function SiteHeader() {
  const match = useMatch({ from: '/_app/$app', shouldThrow: false })
  const app = match ? getApp(match.params.app) : undefined
  return (
    <header className="sticky top-0 z-50 grid h-(--header-height) w-full grid-cols-[minmax(min-content,1fr)_minmax(150px,340px)_minmax(min-content,1fr)] items-center gap-[18px] border-b border-border bg-card px-6">
      <div className="flex min-w-0 items-center gap-[18px] overflow-hidden">
        <BrandMark />
        {app && (
          <>
            <span aria-hidden="true" className="h-6 w-px shrink-0 bg-border" />
            <span className="shrink-0 text-sm font-bold text-body">{app.name}</span>
            <SidebarTrigger className="-ms-2 text-muted-foreground" />
          </>
        )}
      </div>

      <SearchField
        asButton
        size="sm"
        placeholder="Search"
        shortcut={<span className="text-[11px] font-medium tracking-[0.04em] text-muted-foreground">⌘K</span>}
        className="justify-self-center"
      />

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
