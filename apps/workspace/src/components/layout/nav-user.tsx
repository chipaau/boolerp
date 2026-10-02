import { useState } from 'react'
import { AccountMenu, accountMenuItems } from '@workspace/ui/components/workspace-header'
import { AvatarDialog } from '@/features/shell/avatar-dialog'
import { useMembership } from '@/features/shell/queries'
import { signOut } from '@workspace/session'
import { useCurrentUser } from './user-context'

/**
 * The shared account menu — the same items the operator console shows, since it is the same person.
 * The role is not shown: every screen is already gated by it.
 */
export function UserMenu() {
  const user = useCurrentUser()
  const membership = useMembership()
  const [photo, setPhoto] = useState(false)

  return (
    <>
      <AccountMenu
        user={user}
        avatarSrc={membership?.avatar}
        items={accountMenuItems({ onChangePhoto: () => setPhoto(true), onSignOut: signOut })}
      />
      <AvatarDialog open={photo} name={user.name} current={membership?.avatar} onClose={() => setPhoto(false)} />
    </>
  )
}
