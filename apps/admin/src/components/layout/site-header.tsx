import { useLocation, useNavigate } from '@tanstack/react-router'
import { SearchField } from '@workspace/ui/components/search-field'
import { AppGridMenu } from './app-grid-menu'
import { BrandMark } from './brand-mark'
import { UserMenu } from './nav-user'
import { useAdminSearch } from './search-context'
import { ThemeToggle } from './theme-toggle'

/**
 * The global topbar, laid out like apps/app's SiteHeader: brand mark, the search pill in the middle
 * column, then theme, apps, a hairline and the account avatar. The console names itself at the top
 * of its rail. The pill filters whichever list is open; typing from the dashboard jumps to Tenants.
 */
export function SiteHeader() {
  const { query, setQuery } = useAdminSearch()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 grid h-(--header-height) w-full grid-cols-[minmax(min-content,1fr)_minmax(150px,340px)_minmax(min-content,1fr)] items-center gap-[18px] border-b border-border bg-card px-6">
      <div className="flex min-w-0 items-center gap-[18px] overflow-hidden">
        <BrandMark />
      </div>

      <SearchField
        size="sm"
        aria-label="Search tenants, geographies, admin users"
        placeholder="Search tenants, geographies, admin users"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (pathname === '/') void navigate({ to: '/tenants' })
        }}
        shortcut={
          query ? (
            <button type="button" onClick={() => setQuery('')} className="px-1.5 text-fine font-bold text-faint hover:text-foreground">
              Clear
            </button>
          ) : undefined
        }
      />

      <div className="flex items-center justify-end gap-2 justify-self-end">
        <ThemeToggle />
        <AppGridMenu />
        <span aria-hidden="true" className="mx-1 h-[22px] w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  )
}
