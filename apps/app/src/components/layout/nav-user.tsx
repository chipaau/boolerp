import { useState } from 'react'
import { logout } from '@workspace/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { AvatarDialog } from '@/features/shell/avatar-dialog'
import { useMembership } from '@/features/shell/queries'
import { useCurrentUser } from './user-context'

/**
 * The account menu behind the 31px avatar in the topbar: name and email, then the actions with
 * Sign out in terracotta. The role is not shown: every screen is already gated by it.
 */
export function UserMenu() {
  const user = useCurrentUser()
  const membership = useMembership()
  const [photo, setPhoto] = useState(false)

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`${user.name}. Account menu`}
            title={user.name}
            className="ms-0.5 grid size-[34px] place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
        }
      >
        <Avatar name={user.name} className="size-[31px]">
          {membership?.avatar && <AvatarImage src={membership.avatar} alt="" />}
          <AvatarFallback className="bg-secondary-hover/60 text-micro tracking-[0.02em] text-muted-foreground" />
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 p-2">
        <div className="px-3 pt-1.5 pb-3">
          <div className="text-sm font-bold text-foreground">{user.name}</div>
          <div className="mt-0.5 text-fine text-faint">{user.email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="rounded-[9px] px-3 py-[9px] text-ui-sm" onClick={() => setPhoto(true)}>
            Change photo…
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-[9px] px-3 py-[9px] text-ui-sm">Profile &amp; preferences</DropdownMenuItem>
          <DropdownMenuItem className="rounded-[9px] px-3 py-[9px] text-ui-sm">Settings &amp; permissions</DropdownMenuItem>
          <DropdownMenuItem className="rounded-[9px] px-3 py-[9px] text-ui-sm">Switch workspace</DropdownMenuItem>
          <DropdownMenuItem className="rounded-[9px] px-3 py-[9px] text-ui-sm text-tone-risk-foreground data-highlighted:text-tone-risk-foreground" onClick={() => logout()}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    <AvatarDialog open={photo} name={user.name} current={membership?.avatar} onClose={() => setPhoto(false)} />
    </>
  )
}
