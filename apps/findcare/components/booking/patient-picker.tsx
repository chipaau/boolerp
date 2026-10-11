'use client'

import { Plus } from 'lucide-react'
import { Chip } from '@/components/ui/chip'
import { Overline } from '@/components/ui/text'
import { eligible } from '@/lib/data'
import type { Patient } from '@/lib/data'

/** Who the visit is for: someone on the account, or a new person added to it as they book. */
export type PatientChoice = { kind: 'existing'; id: string } | { kind: 'new'; name: string; dob: string; relation: string }

export const NEW_PERSON: PatientChoice = { kind: 'new', name: '', dob: '', relation: 'child' }

const RELATIONS = [
  ['child', 'Child'],
  ['spouse', 'Spouse'],
  ['parent', 'Parent'],
  ['sibling', 'Sibling'],
  ['other', 'Other'],
] as const

const field =
  'h-11 w-full rounded-[14px] bg-white px-3.5 text-[14px] text-ink-900 shadow-[inset_0_0_0_1px_var(--line-3)] outline-none placeholder:text-ink-400 focus:shadow-[inset_0_0_0_1px_var(--indigo-500)]'

/** Why the chosen person cannot see this doctor, or null when they can (or their age is not known yet). */
export function ineligibility(doctorId: string, people: Patient[], choice: PatientChoice) {
  const dob = choice.kind === 'new' ? choice.dob || null : (people.find((p) => p.id === choice.id)?.dob ?? null)
  const el = eligible(doctorId, dob)
  return el.ok ? null : el.msg
}

export function PatientPicker({
  doctorId,
  people,
  holderId,
  value,
  onChange,
  allowNew = true,
}: {
  doctorId: string
  people: Patient[]
  holderId: string
  value: PatientChoice
  onChange: (c: PatientChoice) => void
  allowNew?: boolean
}) {
  const name = (p: Patient) => (p.id === holderId ? 'Me' : p.name.split(' ')[0] || 'Family member')
  const blocked = people.map((p) => ({
    p,
    msg: (() => {
      const el = eligible(doctorId, p.dob)
      return el.ok ? null : el.msg
    })(),
  }))
  const notes = blocked.filter((x) => x.msg)
  return (
    <div className="flex flex-col gap-2">
      <Overline id="who-label">Who is it for?</Overline>
      <div role="group" aria-labelledby="who-label" className="flex flex-wrap gap-1.5">
        {blocked.map(({ p, msg }) => (
          <Chip
            key={p.id}
            selected={value.kind === 'existing' && value.id === p.id}
            disabled={!!msg}
            title={msg ?? undefined}
            onClick={() => onChange({ kind: 'existing', id: p.id })}
          >
            {name(p)}
            {msg && ' · not eligible'}
          </Chip>
        ))}
        {allowNew && (
          <Chip selected={value.kind === 'new'} onClick={() => onChange(value.kind === 'new' ? value : NEW_PERSON)}>
            <Plus aria-hidden className="size-3.5" strokeWidth={2} />
            Someone else
          </Chip>
        )}
      </div>
      {notes.length > 0 && <p className="text-[12px] text-ink-500">{notes.map(({ p, msg }) => `${p.id === holderId ? 'You' : p.name.split(' ')[0]}: ${msg}`).join(' ')}</p>}
      {value.kind === 'new' && (
        <div className="grid gap-2 pt-1 min-[760px]:grid-cols-2">
          <label className="flex flex-col gap-1 min-[760px]:col-span-2">
            <span className="text-[12px] font-medium text-ink-600">Full name</span>
            <input className={field} value={value.name} autoComplete="off" onChange={(e) => onChange({ ...value, name: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-ink-600">Date of birth</span>
            <input type="date" className={field} value={value.dob} onChange={(e) => onChange({ ...value, dob: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-ink-600">Relation to you</span>
            <select className={field} value={value.relation} onChange={(e) => onChange({ ...value, relation: e.target.value })}>
              {RELATIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[12px] text-ink-500 min-[760px]:col-span-2">We add them to your family, so next time they’re one tap away.</p>
        </div>
      )}
    </div>
  )
}
