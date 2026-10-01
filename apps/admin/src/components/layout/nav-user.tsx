import { AccountMenu } from '@workspace/ui/components/workspace-header'
import { useCurrentUser } from './user-context'

/**
 * The shared account menu for the operator console: name and email (initials until avatars,
 * roadmap step 7g). Sign out returns with the BFF's /auth/logout (step 7e).
 */
export function UserMenu() {
  const user = useCurrentUser()
  return <AccountMenu user={user} items={[]} />
}
