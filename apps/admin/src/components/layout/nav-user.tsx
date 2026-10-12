import { useState } from 'react'
import { AccountMenu, accountMenuItems } from '@workspace/ui/components/workspace-header'
import { PhotoDialog } from '@workspace/ui/components/photo-dialog'
import { signOut, usePortraits, useSetPortrait } from '@workspace/session'
import { useCurrentUser } from './user-context'

/**
 * The same account menu the workspace app shows — one person, one set of choices. The photo is
 * the person's, saved on their account, so the workspace shows the one chosen here (C196).
 */
export function UserMenu() {
  const user = useCurrentUser()
  const [photo, setPhoto] = useState(false)
  const portraits = usePortraits(photo)
  const setPortrait = useSetPortrait()

  return (
    <>
      <AccountMenu user={user} avatarSrc={user.photo} items={accountMenuItems({ onChangePhoto: () => setPhoto(true), onSignOut: signOut })} />
      <PhotoDialog
        open={photo}
        name={user.name}
        current={user.photo}
        choices={portraits.map((p, i) => ({ ...p, label: `Portrait ${i + 1}` }))}
        onSave={async (portrait) => void (await setPortrait.mutateAsync(portrait))}
        onClose={() => setPhoto(false)}
      />
    </>
  )
}
