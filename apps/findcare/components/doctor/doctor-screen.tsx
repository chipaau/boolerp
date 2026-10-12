'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { BookedCard } from '@/components/booking/booked-card'
import { BookingPanel } from '@/components/booking/booking-panel'
import { useHold } from '@/components/booking/use-hold'
import { Page } from '@/components/shell/page'
import { Banner } from '@/components/ui/banner'
import { Button, ButtonLink, buttonClass } from '@/components/ui/button'
import { Card, Panel } from '@/components/ui/card'
import {
  accountAppointments,
  addDays,
  clinicOf,
  db,
  doctorSessions,
  find,
  fmtDate,
  fmtDay,
  nextOpening,
  pickAvailable,
  queueState,
  slotState,
  slotTimes,
  today,
  useAccount,
  useNow,
} from '@/lib/data'
import type { Account, Appointment, Clinic, Doctor, SlotPick } from '@/lib/data'
import { routes } from '@/lib/routes'
import { BranchPicker } from './branch-picker'
import { DateStrip } from './date-strip'
import type { DayInfo } from './date-strip'
import { ProfileCard } from './profile-card'
import { SessionList } from './session-list'
import { WaitlistDialog } from './waitlist-dialog'

/** How far ahead the strip and calendar reach. */
const WINDOW_DAYS = 60
const ENDED = ['cancelled', 'completed', 'no_show', 'rescheduled']

/** Where "back" leads: the page the patient came from (`?from=`), else Appointments when rescheduling, else Find care. */
function backTo(from: string | null, clinic: Clinic, resched: boolean) {
  if (from === 'clinic') return { href: routes.clinic(clinic.id), label: clinic.name }
  if (from === 'doctors') return { href: routes.find('doctors'), label: 'All doctors' }
  if (from === 'services') return { href: routes.find('services'), label: 'All services' }
  if (resched) return { href: routes.appointments(), label: 'Appointments' }
  if (from === 'mycare') return { href: routes.myCare(), label: 'My Care' }
  return { href: routes.find(), label: 'Find care' }
}

/** Waits for the browser's data, then shows the doctor, or says there is no such doctor. */
export function DoctorScreen({ id, query }: { id: string; query: ReadonlyURLSearchParams }) {
  const ready = useNow()
  const { account } = useAccount()
  if (!ready)
    return (
      <Page>
        <div aria-busy className="h-[420px] rounded-[22px] bg-glass" />
      </Page>
    )
  const doctor = find.doctor(id)
  if (!doctor)
    return (
      <Page>
        <Card className="flex flex-col items-start gap-3 rounded-[22px] p-[22px]">
          <h1 className="text-[22px] font-semibold">Doctor not found</h1>
          <p className="text-[13.5px] text-ink-600">This link may be old, or the doctor no longer takes bookings here.</p>
          <ButtonLink href={routes.find()}>Find care</ButtonLink>
        </Card>
      </Page>
    )
  return <DoctorView doctor={doctor} account={account} query={query} />
}

function DoctorView({ doctor, account, query }: { doctor: Doctor; account: Account | null; query: ReadonlyURLSearchParams }) {
  const router = useRouter()
  const s = db()
  const t = today()
  const branchIds = Object.keys(doctor.fees)

  // Rescheduling only applies to a live visit of the signed-in account with this doctor.
  const r = find.appointment(query.get('resched'))
  const resched = r && account && r.accountId === account.id && r.doctorId === doctor.id && !ENDED.includes(r.status) ? r : undefined

  const [branchId, setBranchId] = useState(() => {
    const b = query.get('b') ?? resched?.branchId
    return b && branchIds.includes(b) ? b : branchIds[0]
  })
  const [date, setDate] = useState(() => {
    const d = query.get('date')
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= t && d <= addDays(t, WINDOW_DAYS - 1)) return d
    return nextOpening(doctor.id, branchId, t, addDays(t, WINDOW_DAYS - 1))?.date ?? t
  })
  const hold = useHold(!!account)
  const [lost, setLost] = useState('')
  const [done, setDone] = useState<{ appt: Appointment; moved: boolean } | null>(null)
  const [resumed, setResumed] = useState(false)
  const [waitlistOpen, setWaitlistOpen] = useState(query.get('wl') === '1')

  const branch = s.branches[branchId]
  const clinic = clinicOf(branchId)
  const spec = s.specialties.find((x) => x.id === doctor.spec)
  const all = doctorSessions(doctor.id, branchId, t, addDays(t, WINDOW_DAYS - 1))

  // Returning from sign-in with a pick (?sid=&slot=): take it again if it is still free, then tidy the URL.
  const resumedOnce = useRef(false)
  useEffect(() => {
    const sid = query.get('sid')
    if (resumedOnce.current || !sid) return
    resumedOnce.current = true
    const known = all.some((se) => se.id === sid)
    const p: SlotPick = { sessionId: sid, time: query.get('slot') }
    if (known && pickAvailable(p) && hold.choose(p)) setResumed(!!account)
    else setLost('The time you picked was taken while you signed in. Here are the other open times.')
    const q = new URLSearchParams(query.toString())
    q.delete('sid')
    q.delete('slot')
    router.replace(`${routes.doctor(doctor.id)}${q.size ? `?${q.toString()}` : ''}`, { scroll: false })
    // Once, on arrival.
  }, [])

  const days: DayInfo[] = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const d = addDays(t, i)
    const ses = all.filter((se) => se.date === d && se.status === 'active')
    const open = !clinic.paused && ses.some((se) => (se.mode === 'exact' ? slotTimes(se).some((tm) => slotState(se, tm).available) : queueState(se).available))
    return { date: d, has: ses.length > 0, open }
  })
  const sessions = all.filter((se) => se.date === date)
  const session = hold.pick ? all.find((se) => se.id === hold.pick?.sessionId) : undefined

  // Where sign-in returns to: this page as it stands, with the pick, so it can be held on return.
  const back = new URLSearchParams()
  back.set('b', branchId)
  back.set('date', date)
  if (resched) back.set('resched', resched.id)
  const from = query.get('from')
  if (from) back.set('from', from)
  if (hold.pick) {
    back.set('sid', hold.pick.sessionId)
    if (hold.pick.time) back.set('slot', hold.pick.time)
  }
  const signInHref = routes.signIn(`${routes.doctor(doctor.id)}?${back.toString()}`)
  const waitlistSignIn = routes.signIn(`${routes.doctor(doctor.id)}?b=${branchId}&date=${date}${from ? `&from=${encodeURIComponent(from)}` : ''}&wl=1`)

  const reset = () => {
    hold.clear()
    setDone(null)
    setLost('')
    setResumed(false)
  }
  const choose = (p: SlotPick) => {
    setDone(null)
    setResumed(false)
    setLost(hold.choose(p) ? '' : 'That time was just taken. Please pick another.')
  }
  const onLost = () => {
    hold.clear()
    setLost('That time was just taken. Please pick another.')
  }

  // Something open soon, offered beside a "just taken" message so the patient isn't left at a dead end.
  const alt = lost ? nextOpening(doctor.id, branchId, date, addDays(t, WINDOW_DAYS - 1)) : null

  // The account's next visit with this doctor, and any waitlist for it, so nobody books twice by accident.
  const mine = (() => {
    if (!account || resched || done) return null
    const up = accountAppointments(account.id)
      .filter((a) => a.doctorId === doctor.id && a.date >= t && !ENDED.includes(a.status))
      .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
      .at(0)
    const wl = Object.values(s.waitlist).find((w) => w.accountId === account.id && w.doctorId === doctor.id && w.status === 'active')
    if (up)
      return {
        text: `You have a visit with ${doctor.name} ${fmtDay(up.date).toLowerCase()}${up.time ? ` at ${up.time}` : ''}${wl ? ', and you’re on the waitlist for an earlier time.' : '.'}`,
        cta: 'View in Appointments',
        href: routes.appointments({ appt: up.id }),
      }
    if (wl) return { text: `You’re on the waitlist for ${doctor.name}. We’ll text you when a time opens.`, cta: 'View waitlist', href: routes.appointments({ waitlist: wl.id }) }
    return null
  })()

  const backLink = backTo(query.get('from'), clinic, !!resched)
  const dayTitle = fmtDay(date) === fmtDate(date) ? fmtDate(date) : `${fmtDay(date)}, ${fmtDate(date)}`
  const tel = `tel:${branch.phone.replace(/\s/g, '')}`

  return (
    <Page>
      <Link href={backLink.href} className="flex items-center gap-2 self-start text-[12.5px] font-medium text-ink-600 no-underline hover:text-ink-900">
        ← {backLink.label}
      </Link>

      {clinic.paused && (
        <Banner
          tone="warning"
          dot={false}
          title={`${clinic.name} isn’t taking online bookings right now.`}
          action={
            <a href={tel} className={buttonClass({ variant: 'soft', size: 'sm' })}>
              Call {branch.phone}
            </a>
          }
        >
          Times below are shown for reference. Call the clinic to book or check when online booking reopens.
        </Banner>
      )}
      {mine && (
        <Banner
          tone="info"
          action={
            <Link href={mine.href} className={buttonClass({ variant: 'soft', size: 'sm' })}>
              {mine.cta} →
            </Link>
          }
        >
          {mine.text}
        </Banner>
      )}
      {resumed && account && hold.pick && !done && (
        <Banner tone="info" dot={false} title="Welcome back.">
          We kept the time you picked. Finish your booking below.
        </Banner>
      )}
      {resched && (
        <Banner tone="info" dot={false} title="Rescheduling">
          your {fmtDay(resched.date)}
          {resched.time ? ` ${resched.time}` : ''} visit. Pick a new time below.
        </Banner>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 min-[900px]:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <ProfileCard doctor={doctor} spec={spec} signedIn={!!account} signInHref={signInHref} />
          <BranchPicker
            doctor={doctor}
            branchId={branchId}
            onPick={(b) => {
              reset()
              setBranchId(b)
            }}
          />
        </div>

        <div className="flex flex-col gap-4">
          <section aria-label="Availability" className="glass flex flex-col gap-4 rounded-[22px] p-5">
            <DateStrip
              days={days}
              value={date}
              onPick={(d) => {
                reset()
                setDate(d)
              }}
            />
            <h3 className="text-[15px] font-semibold">{dayTitle}</h3>
            {lost && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-danger-bg px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-[#8a2238]">
                <span className="flex-[1_1_220px]">
                  {lost}
                  {alt && ` The next open time is ${fmtDay(alt.date).toLowerCase()} at ${alt.time ?? alt.window}.`}
                </span>
                {alt && (
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() => {
                      setDate(alt.date)
                      choose({ sessionId: alt.sessionId, time: alt.time ?? null })
                    }}
                  >
                    Take {alt.time ?? 'a place'}
                  </Button>
                )}
              </div>
            )}
            <SessionList sessions={sessions} pick={hold.pick} holdId={hold.holdId} paused={clinic.paused} onPick={choose} />
            <Panel className="flex items-center justify-between gap-3 text-[13px] text-ink-600">
              <span>No time that suits? We’ll text you if an earlier one opens.</span>
              <Button variant="soft" size="sm" onClick={() => setWaitlistOpen(true)}>
                Join waitlist
              </Button>
            </Panel>
          </section>

          {hold.pick && session && !done && (
            <BookingPanel
              key={`${session.id}|${hold.pick.time ?? ''}`}
              doctor={doctor}
              clinic={clinic}
              branch={branch}
              session={session}
              pick={hold.pick}
              account={account}
              resched={resched}
              hold={hold}
              signInHref={signInHref}
              onBooked={(appt) => setDone({ appt, moved: !!resched })}
              onLost={onLost}
            />
          )}
          {done && <BookedCard appt={done.appt} doctor={doctor} clinic={clinic} branch={branch} moved={done.moved} />}
        </div>
      </div>

      {waitlistOpen && <WaitlistDialog open onOpenChange={setWaitlistOpen} doctor={doctor} branchId={branchId} account={account} resched={resched} signInHref={waitlistSignIn} />}
    </Page>
  )
}
