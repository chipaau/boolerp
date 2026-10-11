'use client'

import { ArrowRight, ListFilter, Search, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import type { FormEvent } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { Chip } from '@/components/ui/chip'
import { Dropdown } from '@/components/ui/dropdown'
import type { Specialty } from '@/lib/data'

export type SearchTab = 'spec' | 'svc'

const TABS: { id: SearchTab; label: string }[] = [
  { id: 'spec', label: 'Specialists' },
  { id: 'svc', label: 'Services' },
]

/**
 * The hero's search card: Specialists or Services, the search pill, the five first specialties as
 * chips and the rest in a dropdown. Picking a chip runs the search for it; picking it again clears.
 */
export function SearchPanel({
  tab,
  onTab,
  q,
  onQ,
  onSubmit,
  onClear,
  showClear,
  spec,
  onSpec,
  specialties,
  advancedHref,
}: {
  tab: SearchTab
  onTab: (tab: SearchTab) => void
  q: string
  onQ: (q: string) => void
  onSubmit: () => void
  onClear: () => void
  showClear: boolean
  spec: string | null
  onSpec: (s: Specialty | null) => void
  specialties: Specialty[]
  advancedHref: string
}) {
  const mine = specialties.filter((s) => (s.group === 'service') === (tab === 'svc'))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }
  return (
    <div className="rounded-[26px] bg-white/74 px-[22px] pt-[22px] pb-[18px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.95),0_24px_60px_rgba(106,92,176,.14)] backdrop-blur-[20px] backdrop-saturate-[1.2]">
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tab === t.id}
              onClick={() => onTab(t.id)}
              className={cn(
                'h-8 cursor-pointer rounded-full px-3.5 text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                tab === t.id ? 'bg-indigo-900 text-white' : 'text-ink-700 hover:text-ink-900',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Link
          href={advancedHref}
          aria-label="Advanced search"
          title="Advanced search"
          className="flex size-8 items-center justify-center rounded-full text-indigo-500 transition-colors outline-none hover-ghost focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <SlidersHorizontal aria-hidden className="size-[15px]" strokeWidth={1.8} />
        </Link>
      </div>

      <form
        role="search"
        onSubmit={submit}
        className="flex h-[54px] min-w-0 items-center gap-2 rounded-full bg-white pr-1.5 pl-[18px] shadow-[inset_0_0_0_1px_rgba(30,10,24,.1)] focus-within:ring-2 focus-within:ring-indigo-500/40"
      >
        <Search aria-hidden className="size-[17px] shrink-0 text-ink-500" strokeWidth={1.8} />
        <input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          aria-label="Search"
          placeholder={tab === 'svc' ? 'Blood test, physiotherapy, vaccination…' : 'Doctor, specialty or clinic'}
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-400"
        />
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-500 transition-colors outline-none hover-ghost hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X aria-hidden className="size-[13px]" strokeWidth={2} />
          </button>
        )}
        <button
          type="submit"
          aria-label="Search"
          className="cta-label flex h-[42px] min-w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-indigo-900 text-white transition-colors outline-none hover:bg-indigo-950 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 min-[760px]:px-5"
        >
          <span className="hidden min-[760px]:inline">Search</span>
          <ArrowRight aria-hidden className="size-4 min-[760px]:hidden" strokeWidth={2} />
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5 px-0.5 pt-3.5">
        {mine.slice(0, 5).map((s) => {
          const on = spec === s.id
          return (
            <Chip key={s.id} size="sm" selected={on} onClick={() => onSpec(on ? null : s)} className={cn('gap-2 pr-3 pl-[9px] text-[12.5px]', !on && 'bg-glass')}>
              <span aria-hidden className="size-2 rounded-full" style={{ background: `var(--tint-${s.tint}-fg)` }} />
              {s.name}
            </Chip>
          )
        })}
        <Dropdown
          variant="chip"
          size="sm"

          label={tab === 'svc' ? 'All services' : 'All specialties'}
          icon={<ListFilter className="size-3.5" strokeWidth={1.8} />}
          value={spec ?? ''}
          onChange={(v) => onSpec(specialties.find((s) => s.id === v) ?? null)}
          options={mine.map((s) => ({ value: s.id, label: s.name, dot: `var(--tint-${s.tint}-fg)` }))}
        />
      </div>
    </div>
  )
}
