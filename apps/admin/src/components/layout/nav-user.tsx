import { identityPhoto, logout } from '@workspace/auth'
import { AccountMenu } from '@workspace/ui/components/workspace-header'
import { useCurrentUser } from './user-context'

/**
 * The shared account menu for the operator console: photo, name and email, then Sign out in
 * terracotta. No avatar upload / membership / workspace switch here yet.
 */
export function UserMenu() {
  const user = useCurrentUser()
  return <AccountMenu user={user} avatarSrc={identityPhoto(user)} items={[{ key: 'signout', label: 'Sign out', destructive: true, onClick: () => void logout() }]} />
}
