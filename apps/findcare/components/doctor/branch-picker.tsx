'use client'

import { MapPin } from 'lucide-react'
import Link from 'next/link'
import { directionsHref } from '@/lib/visit-files'
import { cn } from '@workspace/ui/lib/utils'
import { buttonClass } from '@/components/ui/button'
import { Overline } from '@/components/ui/text'
import { clinicOf, db, payMode } from '@/lib/data'
import type { Doctor } from '@/lib/data'
import { routes } from '@/lib/routes'

const tel = (phone: string) => `tel:${phone.replace(/\s/g, '')}`

/** Where the doctor sees patients, with the fee at each; the chosen branch's address, hours and contacts. */
export function BranchPicker({ doctor, branchId, onPick }: { doctor: Doctor; branchId: string; onPick: (id: string) => void }) {
  const s = db()
  const ids = Object.keys(doctor.fees)
  const branch = s.branches[branchId]
  const clinic = clinicOf(branchId)
  const maps = directionsHref(branch.id)
  return (
    <section className="glass flex flex-col gap-2 rounded-[22px] px-2.5 pt-5 pb-4">
      <div className="flex items-center justify-between gap-2.5 px-2.5 pb-2">
        <Overline>{ids.length > 1 ? 'Choose a location' : 'Location'}</Overline>
        <Link href={routes.clinic(clinic.id)} className="text-[12px] font-medium text-indigo-500 no-underline hover:text-indigo-900">
          Clinic page →
        </Link>
      </div>
      {ids.map((id) => {
        const b = s.branches[id]
        const c = clinicOf(id)
        const on = id === branchId
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(id)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-colors outline-none hover-glass focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full transition-colors', on ? 'bg-indigo-900 text-white' : 'bg-info-bg text-[var(--tint-lilac-fg)]')}>
              <MapPin aria-hidden className="size-[15px]" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-ink-900">
                {b.name.replace(' — ', ' · ')}
                {on && <span className="sr-only"> (selected)</span>}
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-ink-600">
                {c.name} · {payMode(c.id)}
              </span>
            </span>
            <span className="shrink-0 text-[13px] font-semibold text-ink-900 tabular-nums">MVR {doctor.fees[id]}</span>
          </button>
        )
      })}
      <div className="flex flex-col gap-3 px-3 pt-3">
        <div className="text-[12.5px] leading-[1.6] text-ink-700">
          {branch.address}
          <span className="block text-ink-500">{branch.hours}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <a href={maps} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: 'primary', size: 'sm' }, 'h-8 px-[13px] text-[12px] font-medium tracking-normal normal-case')}>
            Directions ↗
          </a>
          {branch.phone && (
            <a href={tel(branch.phone)} className={buttonClass({ variant: 'ghost', size: 'sm' }, 'h-8 px-[13px] text-[12px] shadow-outline tabular-nums')}>
              {branch.phone}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
