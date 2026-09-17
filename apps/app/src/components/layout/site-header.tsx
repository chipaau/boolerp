import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import logo from '@workspace/assets/logos/bool-logo.png'
import {
  BrandMark,
  HeaderDivider,
  HeaderSearchTrigger,
  ThemeToggle,
  WorkspaceHeader,
} from '@workspace/ui/components/workspace-header'
import { BRAND } from '@/lib/brand'
import { AppSwitcher } from './app-switcher'
import { CommandPalette } from './command-palette'
import { UserMenu } from './nav-user'
import { NotificationsMenu } from './notifications-menu'
import { TenantMenu } from './tenant-menu'

/**
 * The global topbar, composed from the shared WorkspaceHeader parts (identical in apps/admin):
 * brand mark, the search pill, then theme, workspace, apps, a hairline, notifications and the
 * account avatar. The app identifies itself at the top of its rail.
 */
export function SiteHeader() {
  const [searchOpen, setSearchOpen] = useState(false)
  return (
    <>
      <WorkspaceHeader
        brand={<BrandMark logoSrc={logo} name={BRAND.name} render={<Link to="/" />} />}
        search={<HeaderSearchTrigger onOpen={() => setSearchOpen(true)} />}
        actions={
          <>
            <ThemeToggle />
            <TenantMenu />
            <AppSwitcher />
            <HeaderDivider />
            <NotificationsMenu />
            <UserMenu />
          </>
        }
      />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
