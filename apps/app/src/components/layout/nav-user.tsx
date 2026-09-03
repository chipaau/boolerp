import type { ReactElement, ReactNode } from 'react'
import { BadgeCheck, Bell, ChevronsUpDown, LogOut } from 'lucide-react'
import { createLogoutFlow } from '@workspace/auth'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@workspace/ui/components/sidebar'
import { useCurrentUser } from './user-context'

// The account dropdown, shared by the header avatar and the sidebar footer. `render` is the
// element that becomes the trigger; `children` is what shows inside it.
function UserDropdown({
  render,
  side,
  children,
}: {
  render: ReactElement
  side: 'bottom' | 'right'
  children: ReactNode
}) {
  const user = useCurrentUser()

  async function logout() {
    const flow = await createLogoutFlow()
    window.location.href = flow?.logout_url ?? '/login'
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={render}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" side={side} align="end">
        <DropdownMenuLabel className="p-0 normal-case tracking-normal">
          <div className="flex items-center gap-2.5 px-2.5 py-2 text-left">
            <Avatar name={user.name} className="rounded-md">
              <AvatarFallback className="rounded-md" />
            </Avatar>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-bold text-foreground">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <BadgeCheck />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Bell />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Header avatar button that opens the account menu. */
export function UserMenu() {
  const user = useCurrentUser()
  return (
    <UserDropdown
      side="bottom"
      render={
        <button
          type="button"
          aria-label="Account menu"
          className="ms-1 rounded-full outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        />
      }
    >
      <Avatar name={user.name}>
        <AvatarFallback />
      </Avatar>
    </UserDropdown>
  )
}

/** Sidebar-footer variant (name + email row) used inside each app. */
export function NavUser() {
  const { isMobile } = useSidebar()
  const user = useCurrentUser()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <UserDropdown side={isMobile ? 'bottom' : 'right'} render={<SidebarMenuButton size="lg" variant="pill" />}>
          <Avatar name={user.name} className="rounded-md">
            <AvatarFallback className="rounded-md" />
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-bold">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
          <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
        </UserDropdown>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
