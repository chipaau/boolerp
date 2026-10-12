'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { Page } from '@/components/shell/page'
import { SignedIn } from '@/components/shell/signed-in'
import { Banner } from '@/components/ui/banner'
import { ButtonLink } from '@/components/ui/button'
import { PageTitle } from '@/components/ui/text'
import { VisitRow } from '@/components/visits/visit-row'
import { appointmentSummary, isUpcoming, waitlistSummary } from '@/components/visits/summary'
import type { Account, Appointment, Patient } from '@/lib/data'
import { accountAppointments, db, find } from '@/lib/data'
import { routes } from '@/lib/routes'
import { AppointmentDetail } from './appointment-detail'
import { OfferBanner, OfferOutcomes, activeOffers } from './offers'
import { WaitlistDetail } from './waitlist-detail'

type Tab = 'upcoming' | 'past' | 'waitlists'

const EMPTY: Record<Tab, string> = {
  upcoming: 'No upcoming appointments',
  past: 'No past appointments',
  waitlists: 'No waitlists',
}

const at = (a: Appointment) => a.date + (a.time ?? '')

/** Where a link lands: ?appt= or ?pay= opens that visit on its tab, ?waitlist= the waitlists, ?tab= a tab. */
function fromLink(params: URLSearchParams): { tab: Tab; open: string | null } {
  const visit = find.appointment(params.get('appt') ?? params.get('pay'))
  if (visit) return { tab: isUpcoming(visit) ? 'upcoming' : 'past', open: visit.id }
  if (params.has('waitlist'))
    return {
      tab: 'waitlists',
      open: find.waitlist(params.get('waitlist'))?.id ?? null,
    }
  const tab = params.get('tab')
  return {
    tab: tab === 'past' || tab === 'waitlists' ? tab : 'upcoming',
    open: null,
  }
}

export function AppointmentsScreen() {
  return <SignedIn>{({ account, holder }) => <Appointments account={account} holder={holder} />}</SignedIn>
}

function Appointments({ account, holder }: { account: Account; holder: Patient }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  // Rendered only once the data has loaded (SignedIn), so the link can be resolved on first render.
  const [{ tab, open }, setView] = useState(() => fromLink(new URLSearchParams(params.toString())))
  const [msg, setMsg] = useState<string | null>(null)

  // A deep link to one visit scrolls it into view, once, on arrival.
  const [linked] = useState(open)
  useEffect(() => {
    if (linked) document.getElementById(`row-${linked}`)?.scrollIntoView({ block: 'center' })
  }, [linked])

  const pick = (t: Tab) => {
    setView({ tab: t, open: null })
    // The tab is kept in the URL so back and reload return to it; the one-off deep-link ids are dropped.
    router.replace(t === 'upcoming' ? pathname : routes.appointments({ tab: t }), { scroll: false })
  }
  const toggle = (id: string) => setView((v) => ({ ...v, open: v.open === id ? null : id }))

  const all = accountAppointments(account.id).filter((a) => a.status !== 'rescheduled')
  const upcoming = all.filter(isUpcoming).sort((a, b) => at(a).localeCompare(at(b)))
  const past = all.filter((a) => !isUpcoming(a)).sort((a, b) => at(b).localeCompare(at(a)))
  const people = new Set([account.holderId, ...account.familyIds])
  const waitlists = Object.values(db().waitlist)
    .filter((w) => w.accountId === account.id || people.has(w.patientId))
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.createdAt - a.createdAt)
  const offers = activeOffers(account.id, params.get('offer'))

  const tabs: { id: Tab; label: string }[] = [
    { id: 'upcoming', label: `Upcoming · ${upcoming.length}` },
    { id: 'past', label: 'Past' },
    {
      id: 'waitlists',
      label: `Waitlists · ${waitlists.filter((w) => w.status === 'active').length}`,
    },
  ]
  const visits = tab === 'upcoming' ? upcoming : tab === 'past' ? past : []
  const empty = tab === 'waitlists' ? waitlists.length === 0 : visits.length === 0

  return (
    <Page>
      {/* One reading column, as narrow as the prototype's: the page's own width is for grids. */}
      <div className="mx-auto flex w-full max-w-[824px] flex-col gap-[22px]">
        <PageTitle overline="Your visits" title="Appointments" />

        {msg && (
          <Banner tone="info" dot={false} className="animate-fc-rise font-medium">
            {msg}
          </Banner>
        )}
        {offers.map((o) => (
          <OfferBanner key={o.id} offer={o} onMessage={setMsg} />
        ))}
        <OfferOutcomes account={account} />

        <div role="tablist" aria-label="Appointments" className="flex flex-wrap gap-1.5 self-start">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="appointments-panel"
              onClick={() => pick(t.id)}
              className={cn(
                'h-9 cursor-pointer rounded-full px-4 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                tab === t.id ? 'bg-indigo-900 text-white' : 'text-ink-700 hover-ghost',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="appointments-panel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-3">
          {empty && (
            <div className="glass flex flex-col items-center gap-2.5 rounded-[22px] p-9 text-center">
              <h2 className="text-[17px] font-semibold">{EMPTY[tab]}</h2>
              <p className="text-[13px] leading-normal text-ink-600">Find a doctor, clinic or service and book in a minute.</p>
              <ButtonLink href={routes.find()} className="mt-2 h-10">
                Find care
              </ButtonLink>
            </div>
          )}

          {visits.map((a) => (
            <div key={a.id} id={`row-${a.id}`} className="flex scroll-mt-28 flex-col gap-1.5">
              <VisitRow summary={appointmentSummary(a, holder.id)} open={open === a.id} onToggle={() => toggle(a.id)} controls={`detail-${a.id}`} muted={tab === 'past'} />
              {open === a.id && <AppointmentDetail appt={a} id={`detail-${a.id}`} onMessage={setMsg} onClose={() => setView((v) => ({ ...v, open: null }))} />}
            </div>
          ))}

          {tab === 'waitlists' &&
            waitlists.map((w) => (
              <div key={w.id} id={`row-${w.id}`} className="flex scroll-mt-28 flex-col gap-1.5">
                <VisitRow summary={waitlistSummary(w, holder.id)} open={open === w.id} onToggle={() => toggle(w.id)} controls={`detail-${w.id}`} muted={w.status !== 'active'} />
                {open === w.id && (
                  <WaitlistDetail
                    entry={w}
                    account={account}
                    id={`detail-${w.id}`}
                    onMessage={setMsg}
                    onClose={() => setView((v) => ({ ...v, open: null }))}
                    onShowVisit={(apptId) => setView({ tab: 'upcoming', open: apptId })}
                  />
                )}
              </div>
            ))}
        </div>
      </div>
    </Page>
  )
}
