'use client'

import { routes } from '@/lib/routes'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { db, search, useAccount, useNow } from '@/lib/data'
import type { Account, Specialty } from '@/lib/data'
import { HeroArt } from './hero-art'
import { ClinicsSection, OpenSoonest, ServicesSection, WhySignIn, YourDoctorsSection } from './idle-sections'
import { SearchLoading } from './loading'
import { bySoonest, clinicSummaries } from './openings'
import { RowGrid } from './row-card'
import { EmptyNote, SectionHead } from './section-head'
import { SearchPanel } from './search-panel'
import type { SearchTab } from './search-panel'

type Mode = 'idle' | 'loading' | 'results'

const LOADING_MS = 1900

/**
 * Find care at rest: the hero with its search card, then doctors open soonest, clinics, services
 * and, signed out, why to sign in. A search (typed, or a specialty picked) folds the hero up and
 * shows results in place of the sections; clearing it returns to rest.
 */
export function FindHome() {
  const ready = useNow()
  const { account } = useAccount()
  const params = useSearchParams()
  const [tab, setTab] = useState<SearchTab>('spec')
  const [q, setQ] = useState('')
  const [spec, setSpec] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [mode, setMode] = useState<Mode>('idle')
  const timer = useRef<number | undefined>(undefined)

  const run = (query: string, specId: string | null, title: string) => {
    window.clearTimeout(timer.current)
    setQ(query)
    setSpec(specId)
    setLabel(title)
    setMode('loading')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    timer.current = window.setTimeout(() => setMode('results'), LOADING_MS)
  }
  const clear = () => {
    window.clearTimeout(timer.current)
    setMode('idle')
    setQ('')
    setSpec(null)
  }

  // A link may arrive with a search (?q=), which runs straight to results.
  const initialQ = params.get('q')?.trim() ?? ''
  useEffect(() => {
    if (initialQ) {
      setQ(initialQ)
      setLabel(`“${initialQ}”`)
      setMode('results')
    }
  }, [initialQ])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const active = mode !== 'idle'
  const specialties = ready ? db().specialties : []
  const pickSpec = (s: Specialty | null) => (s ? run('', s.id, s.name) : clear())
  const specIsService = specialties.find((s) => s.id === spec)?.group === 'service'

  return (
    <>
      {/* The hero spans the window, as designed: the art sits at 70% of the window's width and may
          spread to its edges, while the search card stays on the page's content column. On phones it
          is only as tall as its content and starts at the top, so the search is in reach at once. */}
      <section
        className={cn(
          'relative -mt-5 ml-[calc(50%-50vw)] w-screen transition-[height] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)] min-[760px]:-mt-7',
          active ? 'h-[250px] min-[760px]:h-[290px]' : 'min-[760px]:h-[min(720px,calc(100svh-var(--header-h)))]',
        )}
      >
        <HeroArt compact={active} />
        <div className={cn('page relative z-[5] flex h-full flex-col', active ? 'justify-start pt-5' : 'justify-start pt-8 pb-10 min-[760px]:justify-center min-[760px]:py-0')}>
          <div className={cn('w-full', active ? 'max-w-[640px]' : 'max-w-[520px]')}>
            <div className={cn('overflow-hidden transition-[max-height,opacity] duration-700', active ? 'max-h-0 opacity-0' : 'max-h-60 opacity-100')}>
              <div className="pb-7">
                <div className="eyebrow text-[10.5px] tracking-[0.24em] text-ink-500">Healthcare in the Maldives</div>
                <h1 className="mt-4 text-[clamp(34px,8vw,46px)] leading-[1.04] font-normal tracking-[-0.03em] text-ink-500">
                  Find a doctor,
                  <br />
                  <span className="font-semibold text-ink-900">book in a minute.</span>
                </h1>
                <p className="mt-4 max-w-[440px] text-[15px] leading-[1.55] text-pretty text-ink-600">
                  Search specialists and services, see real open times and book. No account needed.
                </p>
              </div>
            </div>
            {ready && (
              <SearchPanel
                tab={tab}
                onTab={setTab}
                q={q}
                onQ={setQ}
                onSubmit={() => q.trim() && run(q.trim(), null, `“${q.trim()}”`)}
                onClear={clear}
                showClear={active}
                spec={spec}
                onSpec={pickSpec}
                specialties={specialties}
                advancedHref={routes.find(tab === 'svc' ? 'services' : 'doctors', { q })}
              />
            )}
          </div>
        </div>
      </section>

      {ready && mode === 'loading' && <SearchLoading />}
      {ready && mode === 'results' && <Results q={q} spec={spec} label={label} filtersHref={routes.find(specIsService ? 'services' : 'doctors', { spec: spec ?? undefined, q })} />}
      {ready && mode === 'idle' && <Idle account={account} specialties={specialties} onPickService={(s) => run('', s.id, s.name)} />}
    </>
  )
}

function Results({ q, spec, label, filtersHref }: { q: string; spec: string | null; label: string; filtersHref: string }) {
  const rows = search({ q, spec: spec ?? undefined }).sort(bySoonest)
  return (
    <section className="animate-fc-rise flex flex-col gap-5 pt-7">
      <SectionHead overline={`${rows.length} ${rows.length === 1 ? 'result' : 'results'}`} title={label} link={{ href: filtersHref, label: 'Filters →' }} />
      {rows.length === 0 && <EmptyNote>No one matches that yet. Try a specialty below the search, or a clinic name.</EmptyNote>}
      <RowGrid rows={rows} />
    </section>
  )
}

function Idle({ account, specialties, onPickService }: { account: Account | null; specialties: Specialty[]; onPickService: (s: Specialty) => void }) {
  const rows = search({})
  return (
    <>
      {account && <YourDoctorsSection account={account} rows={rows} />}
      <OpenSoonest rows={rows} />
      <ClinicsSection clinics={clinicSummaries(rows)} />
      <ServicesSection rows={rows} specialties={specialties} onPick={onPickService} />
      {!account && <WhySignIn />}
    </>
  )
}
