import { AccountMenu } from '@workspace/ui/components/workspace-header'
import { signOut } from '@workspace/session'
import { useCurrentUser } from './user-context'

/**
 * The shared account menu for the operator console: name and email (initials until avatars,
 * roadmap step 7g), then Sign out in terracotta.
 */
export function UserMenu() {
  const user = useCurrentUser()
  return <AccountMenu user={user} items={[{ key: 'signout', label: 'Sign out', destructive: true, onClick: signOut }]} />
}
