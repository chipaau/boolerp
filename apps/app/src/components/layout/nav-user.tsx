import { useState } from 'react'
import { AccountMenu } from '@workspace/ui/components/workspace-header'
import { AvatarDialog } from '@/features/shell/avatar-dialog'
import { useMembership } from '@/features/shell/queries'
import { useCurrentUser } from './user-context'

/**
 * The shared account menu fed with the workspace actions, Sign out in terracotta. The role is not
 * shown: every screen is already gated by it.
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
        items={[
          { key: 'photo', label: 'Change photo…', onClick: () => setPhoto(true) },
          { key: 'profile', label: 'Profile & preferences' },
          { key: 'settings', label: 'Settings & permissions' },
          { key: 'switch', label: 'Switch workspace' },
          // Sign out returns with the BFF's /auth/logout (roadmap step 7e).
        ]}
      />
      <AvatarDialog open={photo} name={user.name} current={membership?.avatar} onClose={() => setPhoto(false)} />
    </>
  )
}
