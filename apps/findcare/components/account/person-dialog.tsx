'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Dialog } from '@/components/ui/dialog'
import { TextField } from '@/components/ui/text-field'
import { addFamilyMember, db, removeFamilyMember, today, updatePatient } from '@/lib/data'
import type { Account } from '@/lib/data'

const RELATIONS = ['Son', 'Daughter', 'Spouse', 'Parent', 'Other'] as const

/** Which person the dialog is for: the holder, a family member, or a new one. */
export type PersonTarget = { kind: 'holder' } | { kind: 'member'; id: string } | { kind: 'new' }

/** Adds, edits or removes a person; the holder can be edited but has no relationship and no remove. */
export function PersonDialog({ account, target, open, onClose }: { account: Account; target: PersonTarget; open: boolean; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const id = target.kind === 'holder' ? account.holderId : target.kind === 'member' ? target.id : null
  const person = id ? db().patients[id] : null
  const first = person?.name.split(' ')[0] ?? ''
  const kicker = target.kind === 'new' ? 'Family' : target.kind === 'holder' ? 'Your profile' : 'Family member'
  const title = confirming ? 'Remove family member' : target.kind === 'new' ? 'Add a family member' : target.kind === 'holder' ? 'Edit your details' : `Edit ${first}`
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} kicker={kicker} title={title} width={440}>
      {confirming && id ? (
        <>
          <p className="text-[14px] leading-[1.55] text-ink-700">
            Remove <b className="font-semibold text-ink-900">{person?.name}</b> from your family? Their past visits stay on record; you just won’t be able to book for them.
          </p>
          <div className="flex gap-2">
            <Button
              variant="dangerSolid"
              className="h-11 flex-1"
              onClick={() => {
                removeFamilyMember(account.id, id)
                onClose()
              }}
            >
              Remove
            </Button>
            <Button variant="outline" className="h-11 flex-1" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        </>
      ) : (
        <PersonForm account={account} target={target} onDone={onClose} onRemove={() => setConfirming(true)} />
      )}
    </Dialog>
  )
}

function PersonForm({ account, target, onDone, onRemove }: { account: Account; target: PersonTarget; onDone: () => void; onRemove: () => void }) {
  const id = target.kind === 'holder' ? account.holderId : target.kind === 'member' ? target.id : null
  const p = id ? db().patients[id] : null
  const [name, setName] = useState(p?.name ?? '')
  const [dob, setDob] = useState(p?.dob ?? '')
  const [relation, setRelation] = useState(p?.relation ?? 'Son')
  const [error, setError] = useState<'name' | 'dob' | null>(null)
  const isHolder = target.kind === 'holder'

  const save = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError('name')
    if (dob && dob > today()) return setError('dob')
    if (target.kind === 'new') addFamilyMember(account.id, { name: n, dob: dob || null, relation })
    else if (id) updatePatient(id, isHolder ? { name: n, dob: dob || null } : { name: n, dob: dob || null, relation })
    onDone()
  }

  return (
    <form noValidate onSubmit={save} className="flex flex-col gap-[18px]">
      <TextField
        label="Full name"
        className="gap-2"
        autoComplete={isHolder ? 'name' : 'off'}
        placeholder={isHolder ? 'As on your ID card' : 'As on their ID card'}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError(null)
        }}
        error={error === 'name' && 'Add a name so clinics know who’s coming.'}
      />
      <TextField
        label="Date of birth"
        className="gap-2"
        type="date"
        max={today()}
        value={dob}
        onChange={(e) => {
          setDob(e.target.value)
          setError(null)
        }}
        error={error === 'dob' && 'The date of birth can’t be in the future.'}
      />
      {!isHolder && (
        <fieldset className="flex flex-col">
          <legend className="eyebrow mb-2 text-ink-500">Relationship</legend>
          <div className="flex flex-wrap gap-1.5">
            {RELATIONS.map((r) => (
              <Chip key={r} selected={relation === r} onClick={() => setRelation(r)} className="h-[34px] text-[12.5px]">
                {r}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}
      <div className="mt-1 flex items-center gap-3">
        <Button type="submit" size="lg" className="flex-1">
          {target.kind === 'new' ? 'Add to family' : 'Save changes'}
        </Button>
        {target.kind === 'member' && (
          <Button variant="danger" size="lg" className="px-3.5" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
    </form>
  )
}
