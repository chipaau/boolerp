import { logout } from '@workspace/auth'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { useCurrentUser } from './user-context'

/**
 * The account menu behind the 31px avatar in the topbar: name and email, then Sign out in
 * terracotta. Simpler than apps/app's UserMenu — no avatar upload / membership / workspace switch
 * for the operator console yet.
 */
export function UserMenu() {
  const user = useCurrentUser()

  return (
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
          <DropdownMenuItem
            className="rounded-[9px] px-3 py-[9px] text-ui-sm text-tone-risk-foreground data-highlighted:text-tone-risk-foreground"
            onClick={() => logout()}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
