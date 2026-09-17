import { useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { ArrowRight, X } from 'lucide-react'
import logo from '@workspace/assets/logos/bool-logo.png'
import { Command, CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from '@workspace/ui/components/command'
import {
  BrandMark,
  HeaderDivider,
  HeaderSearchTrigger,
  ThemeToggle,
  WorkspaceHeader,
} from '@workspace/ui/components/workspace-header'
import { UserMenu } from './nav-user'
import { useAdminSearch } from './search-context'

/**
 * The global topbar, composed from the shared WorkspaceHeader parts (identical to apps/app, minus the
 * app switcher: the console is internal, not one of the tenant's apps). The
 * search pill (click or ⌘K) opens a small dialog whose text filters whichever list is open; typing
 * from the dashboard jumps to Tenants. The query stays applied after the dialog closes.
 */
export function SiteHeader() {
  const { query, setQuery } = useAdminSearch()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  function change(q: string) {
    setQuery(q)
    if (pathname === '/') void navigate({ to: '/tenants' })
  }

  return (
    <>
      <WorkspaceHeader
        brand={<BrandMark logoSrc={logo} render={<Link to="/" />} />}
        search={<HeaderSearchTrigger placeholder={query ? `Search: ${query}` : 'Search'} onOpen={() => setOpen(true)} />}
        actions={
          <>
            <ThemeToggle />
            <HeaderDivider />
            <UserMenu />
          </>
        }
      />
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Filter tenants, geographies and admin users">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search tenants, geographies, admin users"
            shortcut="esc"
            autoFocus
            value={query}
            onValueChange={change}
          />
          <CommandList>
            <CommandGroup heading="Search">
              <CommandItem value="apply" onSelect={() => setOpen(false)}>
                <ArrowRight strokeWidth={1.75} />
                <span className="text-foreground">{query ? `Show matches for “${query}”` : 'Type to filter the open list'}</span>
              </CommandItem>
              {query && (
                <CommandItem value="clear" onSelect={() => setQuery('')}>
                  <X strokeWidth={1.75} />
                  <span className="text-foreground">Clear search</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
