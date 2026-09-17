import { logout } from '@workspace/auth'
import { AccountMenu } from '@workspace/ui/components/workspace-header'
import { useOperatorAvatar } from '@/features/admin-users/queries'
import { useCurrentUser } from './user-context'

/**
 * The shared account menu for the operator console: photo, name and email, then Sign out in
 * terracotta. No avatar upload / membership / workspace switch here yet.
 */
export function UserMenu() {
  const user = useCurrentUser()
  const avatar = useOperatorAvatar(user.email, user.name)
  return <AccountMenu user={user} avatarSrc={avatar} items={[{ key: 'signout', label: 'Sign out', destructive: true, onClick: () => void logout() }]} />
}
