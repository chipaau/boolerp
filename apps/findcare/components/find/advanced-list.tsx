'use client'

import { Clock, MapPin, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { Dropdown } from '@/components/ui/dropdown'
import { SearchField } from '@/components/ui/search-field'
import { db, search, useNow } from '@/lib/data'
import { routes } from '@/lib/routes'
import { ClinicGrid } from './clinic-card'
import type { ListKind } from './list-kind'
import { availableIn, bySoonest, cities, clinicSummaries, isService } from './openings'
import { RowGrid } from './row-card'
import { EmptyNote } from './section-head'

const TABS: { id: ListKind; label: string; title: string; placeholder: string }[] = [
  { id: 'doctors', label: 'Doctors', title: 'Doctors', placeholder: 'Doctor name or specialty' },
  { id: 'clinics', label: 'Clinics', title: 'Clinics', placeholder: 'Clinic name or area' },
  { id: 'services', label: 'Services', title: 'Services', placeholder: 'Blood test, physio, vaccination…' },
]

const WHEN = [
  { value: 'any', label: 'Any date' },
  { value: 'today', label: 'Open today' },
  { value: 'week', label: 'This week' },
]

/**
 * "See all": every doctor, clinic or service, filtered by a search, an area and when they are next
 * open. The filters start from the link (?q, ?spec, ?area, ?when); switching list resets the
 * specialty, which belongs to one list.
 */
export function AdvancedList({ initial }: { initial: ListKind }) {
  const ready = useNow()
  const router = useRouter()
  const params = useSearchParams()
  const [list, setList] = useState<ListKind>(initial)
  const [q, setQ] = useState(params.get('q') ?? '')
  const [spec, setSpec] = useState<string | null>(params.get('spec'))
  const [area, setArea] = useState(params.get('area') ?? 'all')
  const [when, setWhen] = useState(params.get('when') ?? 'any')
  if (!ready) return null

  const tab = TABS.find((t) => t.id === list) ?? TABS[0]
  const pickList = (id: ListKind) => {
    setList(id)
    setSpec(null)
    if (id === 'clinics') setWhen('any')
    router.replace(routes.find(id), { scroll: false })
  }

  const needle = q.trim().toLowerCase()
  const clinics =
    list === 'clinics'
      ? clinicSummaries().filter((c) => (!needle || `${c.name} ${c.places}`.toLowerCase().includes(needle)) && (area === 'all' || c.places.includes(area)))
      : []
  const rows =
    list === 'clinics'
      ? []
      : search({ q, spec: spec ?? undefined })
          .filter((r) => (area === 'all' || r.branch.city === area) && availableIn(r, when) && isService(r) === (list === 'services'))
          .sort(bySoonest)
  const count = list === 'clinics' ? clinics.length : rows.length
  const specName = spec ? db().specialties.find((s) => s.id === spec)?.name : undefined

  return (
    <section className="animate-fc-rise flex flex-col gap-[18px] pt-2 min-[760px]:pt-0">
      <div className="flex flex-col gap-3.5">
        <Link href={routes.find()} className="self-start text-[12.5px] font-medium text-ink-600 no-underline hover:text-ink-900">
          ← Find care
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3.5">
          <h1 className="text-[clamp(26px,5vw,34px)] leading-[1.05] font-semibold tracking-[-0.025em] text-ink-900">{tab.title}</h1>
          <div role="tablist" aria-label="List" className="flex gap-1 rounded-full bg-glass p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,.95),0_6px_18px_rgba(106,92,176,.06)]">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={list === t.id}
                onClick={() => pickList(t.id)}
                className={cn(
                  'h-[34px] cursor-pointer rounded-full px-4 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  list === t.id ? 'bg-indigo-900 text-white' : 'text-ink-700 hover:text-ink-900',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <SearchField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab.placeholder}
          aria-label="Search this list"
          className="h-12 flex-[1_1_280px]"
          trailing={
            q && (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="Clear search"
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-500 transition-colors outline-none hover-ghost hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <X aria-hidden className="size-3" strokeWidth={2} />
              </button>
            )
          }
        />
        <Dropdown
         
          label="Area"
          icon={<MapPin className="size-4" strokeWidth={1.8} />}
          value={area}
          onChange={setArea}
          options={[{ value: 'all', label: 'All areas' }, ...cities().map((c) => ({ value: c, label: c }))]}
        />
        {list !== 'clinics' && <Dropdown label="Available" icon={<Clock className="size-4" strokeWidth={1.8} />} value={when} onChange={setWhen} options={WHEN} />}
      </div>

      <div className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span role="status" className="text-[13px] text-ink-600">
          {count} {count === 1 ? 'result' : 'results'}
        </span>
        {specName && (
          <button
            type="button"
            onClick={() => setSpec(null)}
            aria-label={`Remove specialty filter: ${specName}`}
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--tint-lilac-bg)] pr-[9px] pl-3 text-[12px] font-medium text-indigo-700 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {specName}
            <X aria-hidden className="size-2.5" strokeWidth={2.4} />
          </button>
        )}
      </div>

      {count === 0 && <EmptyNote>Nothing matches that. Try a shorter search.</EmptyNote>}
      {list === 'clinics' ? <ClinicGrid clinics={clinics} /> : <RowGrid rows={rows} from={list} />}
    </section>
  )
}
