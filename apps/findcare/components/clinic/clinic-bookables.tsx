'use client'

import { useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { EmptyNote } from '@/components/find/section-head'
import { isService, openingTimes, rowHref } from '@/components/find/openings'
import { Dropdown } from '@/components/ui/dropdown'
import { ListingCard } from '@/components/ui/listing-card'
import { SearchField } from '@/components/ui/search-field'
import { Overline } from '@/components/ui/text'
import { fmtDay } from '@/lib/data'
import type { SearchRow, Specialty } from '@/lib/data'

type Kind = 'all' | 'doc' | 'svc'

const KINDS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'doc', label: 'Doctors' },
  { id: 'svc', label: 'Services' },
]

/**
 * "Book at …": the clinic's doctors and services, each once at its soonest branch, filtered by kind
 * (only when the clinic has both), a search and a specialty. Changing kind clears the specialty.
 */
export function ClinicBookables({ clinicName, rows }: { clinicName: string; rows: SearchRow[] }) {
  const [kind, setKind] = useState<Kind>('all')
  const [spec, setSpec] = useState('all')
  const [q, setQ] = useState('')

  const specs = [...new Map(rows.map((r) => [r.spec.id, r.spec])).values()].filter((s: Specialty) => kind === 'all' || (kind === 'svc') === (s.group === 'service'))
  const needle = q.trim().toLowerCase()
  const seen = new Set<string>()
  const list = rows
    .filter((r) => (kind === 'all' || (kind === 'svc') === isService(r)) && (spec === 'all' || r.spec.id === spec) && (!needle || `${r.doctor.name} ${r.spec.name}`.toLowerCase().includes(needle)))
    .filter((r) => {
      if (seen.has(r.doctor.id)) return false
      seen.add(r.doctor.id)
      return true
    })
  const hasKinds = rows.some(isService) && rows.some((r) => !isService(r))

  return (
    <section className="flex flex-col gap-[18px] pt-9">
      <div>
        <Overline size="lg">Doctors &amp; services</Overline>
        <h2 className="mt-2.5 text-[24px] leading-[1.1] font-semibold tracking-[-0.02em] text-ink-900">Book at {clinicName}</h2>
      </div>
      <div className="relative z-[5] flex flex-wrap items-center justify-between gap-3">
        {hasKinds && (
          <div role="tablist" aria-label="Show" className="flex gap-0.5">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={kind === k.id}
                onClick={() => {
                  setKind(k.id)
                  setSpec('all')
                }}
                className={cn(
                  'h-8 cursor-pointer rounded-full px-3.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  kind === k.id ? 'bg-indigo-900 text-white' : 'text-ink-600 hover:text-ink-900',
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        )}
        <SearchField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Doctor, specialty or service"
          aria-label="Search this clinic"
          className="ml-auto h-11 min-w-[min(100%,280px)] flex-[0_1_440px] pr-1.5"
          trailing={
            <>
              <span aria-hidden className="h-[22px] w-px shrink-0 bg-line-3" />
              <Dropdown
                variant="ghost"
                size="sm"
               
                label="Specialty"
                value={spec}
                onChange={setSpec}
                options={[{ value: 'all', label: kind === 'svc' ? 'All services' : 'All specialties' }, ...specs.map((s) => ({ value: s.id, label: s.name }))]}
              />
            </>
          }
        />
      </div>
      {list.length === 0 && (
        <EmptyNote className="p-6">Nothing matches that here.</EmptyNote>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(330px,100%),1fr))] gap-[18px]">
        {list.map((r) => (
          <ListingCard
            key={r.key}
            name={r.doctor.name}
            sub={`${isService(r) ? (r.doctor.duration ?? r.spec.name) : r.spec.name} · ${r.branch.name.split(' — ')[0]}`}
            initials={r.doctor.initials}
            tint={r.spec.tint}
            href={rowHref(r, 'clinic')}
            fee={r.fee ? `MVR ${r.fee}` : undefined}
            day={r.next ? fmtDay(r.next.date) : 'No openings in 2 weeks'}
            times={openingTimes(r.doctor.id, r.branch.id, r.next?.date, 3)}
            avatarSize={46}
            className="gap-3.5 p-5"
          />
        ))}
      </div>
    </section>
  )
}
