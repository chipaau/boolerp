'use client'

import { buttonClass } from '@/components/ui/button'
import { Overline } from '@/components/ui/text'
import { fmtDay } from '@/lib/data'
import type { Account, SearchRow, Specialty } from '@/lib/data'
import { knownDoctors } from '@/lib/known-doctors'
import { routes } from '@/lib/routes'
import Link from 'next/link'
import { MadeBy } from '@workspace/ui/components/made-by'
import { ClinicGrid } from './clinic-card'
import type { ClinicSummary } from './openings'
import { isService } from './openings'
import { RowGrid } from './row-card'
import { SectionHead } from './section-head'

/** For a signed-in patient: the doctors they saved or have seen, with their next times. */
export function YourDoctorsSection({ account, rows }: { account: Account; rows: SearchRow[] }) {
  const { ids, saved } = knownDoctors(account)
  const pick = ids
    .map((id) => rows.find((r) => r.doctor.id === id && r.next) ?? rows.find((r) => r.doctor.id === id))
    .filter((r): r is SearchRow => !!r)
    .slice(0, 3)
  if (!pick.length) return null
  return (
    <section className="flex flex-col gap-5 pt-4">
      <SectionHead overline={saved ? 'Saved & seen before' : 'Seen before'} title="Your doctors" />
      <RowGrid rows={pick} />
    </section>
  )
}

/** Three doctors open today or tomorrow, else the three soonest; one card per doctor. */
export function OpenSoonest({ rows }: { rows: SearchRow[] }) {
  const doctors = rows.filter((r) => !isService(r))
  const soon = doctors.filter((r) => r.next && ['Today', 'Tomorrow'].includes(fmtDay(r.next.date)))
  const seen = new Set<string>()
  const pick = (soon.length ? soon : doctors.filter((r) => r.next)).filter((r) => !seen.has(r.doctor.id) && !!seen.add(r.doctor.id)).slice(0, 3)
  return (
    <section className="flex flex-col gap-5 pt-4">
      <SectionHead overline="Open soonest" title="Doctors" link={{ href: routes.find('doctors'), label: 'See all →' }} />
      <RowGrid rows={pick} />
    </section>
  )
}

export function ClinicsSection({ clinics }: { clinics: ClinicSummary[] }) {
  return (
    // the header's "Clinics" link lands here when signed out
    <section id="clinics" className="flex scroll-mt-24 flex-col gap-5 pt-10">
      <SectionHead overline="Book directly" title="Clinics" link={{ href: routes.find('clinics'), label: 'See all →' }} />
      <ClinicGrid clinics={clinics.slice(0, 3)} />
    </section>
  )
}

/** The first four services, each with its provider count and soonest day; picking one searches it. */
export function ServicesSection({ rows, specialties, onPick }: { rows: SearchRow[]; specialties: Specialty[]; onPick: (s: Specialty) => void }) {
  const items = specialties
    .filter((s) => s.group === 'service')
    .slice(0, 4)
    .map((s) => {
      const mine = rows.filter((r) => r.spec.id === s.id)
      const n = new Set(mine.map((r) => r.doctor.id)).size
      const next = mine.flatMap((r) => (r.next ? [r.next.date] : [])).sort()[0]
      return { s, count: `${n} ${n === 1 ? 'provider' : 'providers'}`, next }
    })
  return (
    <section className="flex flex-col gap-5 pt-10">
      <SectionHead overline="Tests & therapy" title="Services" link={{ href: routes.find('services'), label: 'See all →' }} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] gap-3.5">
        {items.map(({ s, count, next }) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            className="glass flex cursor-pointer items-center gap-3 rounded-[18px] px-[18px] py-4 text-left text-ink-900 transition-colors outline-none hover-glass focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--tint-${s.tint}-fg)` }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">{s.name}</span>
              <span className="mt-[3px] block text-[12px] text-ink-600">{count}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className={next ? 'block text-[12.5px] font-semibold' : 'block text-[12.5px] font-semibold text-ink-500'}>{next ? fmtDay(next) : 'Waitlist'}</span>
              <span className="mt-[3px] block text-[9px] font-medium tracking-[0.18em] text-ink-500 uppercase">Next</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

const PERKS = [
  ['Live queue', 'Watch your number move.'],
  ['Earlier slots', 'Get offered sooner times.'],
  ['Book again', 'Your doctors, one tap.'],
  ['Family', 'Book for your children.'],
] as const

/** Signed out only: what an account adds. Booking itself never needs one. */
export function WhySignIn() {
  return (
    <section className="pt-10">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] items-center gap-7 rounded-3xl bg-white/60 px-7 py-6 shadow-card">
        <div>
          <Overline size="lg">Why sign in</Overline>
          <div className="mt-2 text-[18px] leading-tight font-semibold text-balance">Keep every booking tracked in one place.</div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-[18px] text-[12.5px] leading-[1.4] text-ink-600">
          {PERKS.map(([title, line]) => (
            <div key={title}>
              <b className="mb-[3px] block font-semibold text-ink-900">{title}</b>
              {line}
            </div>
          ))}
        </div>
        <Link href={routes.signIn(routes.find())} className={buttonClass({ variant: 'primary', size: 'lg' }, 'h-11 w-max justify-self-end')}>
          Sign in
        </Link>
      </div>
    </section>
  )
}

/** The page foot: the wordmark and where FindCare is. */
export function FindFooter() {
  return (
    // the tab bar covers the bottom of a phone screen, so the footer clears it there
    <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-6 pb-[calc(32px+76px)] text-[12px] text-ink-500 shadow-[inset_0_1px_0_var(--line-2)] min-[760px]:pb-8">
      <span className="wordmark text-[11px] text-ink-900">FindCare</span>
      <span className="flex items-center gap-4">
        Healthcare in the Maldives
        <MadeBy className="font-medium tracking-[0.16em] text-ink-500" />
      </span>
    </footer>
  )
}
