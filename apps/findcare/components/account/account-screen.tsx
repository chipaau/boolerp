'use client'

import { useEffect, useState } from 'react'
import { Page } from '@/components/shell/page'
import { SignedIn } from '@/components/shell/signed-in'
import { PageTitle } from '@/components/ui/text'
import { FamilyCard } from './family-card'
import { PersonDialog } from './person-dialog'
import type { PersonTarget } from './person-dialog'
import { ProfileCard } from './profile-card'

export function AccountScreen() {
  // The target stays set while the dialog animates closed, so its title doesn't change mid-fade.
  const [target, setTarget] = useState<PersonTarget>({ kind: 'new' })
  const [open, setOpen] = useState(false)
  // Each opening is a fresh dialog (no leftover remove confirmation or half-typed name).
  const [opening, setOpening] = useState(0)
  const edit = (t: PersonTarget) => {
    setTarget(t)
    setOpen(true)
    setOpening((n) => n + 1)
  }
  // My Care's "Add a family member" links to /account#add, which opens the add dialog once.
  useEffect(() => {
    if (window.location.hash !== '#add') return
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    edit({ kind: 'new' })
  }, [])
  return (
    <SignedIn>
      {({ account, holder }) => (
        <Page>
          <div className="mx-auto flex w-full max-w-[704px] flex-col gap-[22px]">
            <PageTitle overline="Account" title="Profile & family" />
            <ProfileCard account={account} holder={holder} onEdit={() => edit({ kind: 'holder' })} />
            <FamilyCard account={account} onAdd={() => edit({ kind: 'new' })} onEdit={(id) => edit({ kind: 'member', id })} />
            <PersonDialog key={opening} account={account} target={target} open={open} onClose={() => setOpen(false)} />
          </div>
        </Page>
      )}
    </SignedIn>
  )
}
