import { AccountMenu, accountMenuItems } from '@workspace/ui/components/workspace-header'
import { signOut } from '@workspace/session'
import { useCurrentUser } from './user-context'

/**
 * The same account menu the workspace app shows — one person, one set of choices. "Change photo…"
 * is the exception and is deliberately absent: a photo changed here would live only in this app and
 * disagree with the workspace one, so it waits until the picture lives on the identity itself.
 */
export function UserMenu() {
  const user = useCurrentUser()
  return <AccountMenu user={user} items={accountMenuItems({ onSignOut: signOut })} />
}
