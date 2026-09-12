import { BrandMark } from './brand-mark'
import { UserMenu } from './nav-user'
import { ThemeToggle } from './theme-toggle'

/**
 * The global topbar, same shape as apps/app's SiteHeader (brand mark left, account menu right) —
 * minus the pieces that only make sense in the multi-app tenant workspace: the search command
 * palette (no app registry to index here), the tenant switcher (admin isn't scoped to one tenant),
 * the app switcher (admin is a single console, not a set of modules), and notifications (no data
 * source yet). Just brand, theme, account.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) w-full items-center justify-between gap-[18px] border-b border-border bg-card px-6">
      <div className="flex min-w-0 items-center gap-[18px] overflow-hidden">
        <BrandMark />
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <span aria-hidden="true" className="mx-1 h-[22px] w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  )
}
