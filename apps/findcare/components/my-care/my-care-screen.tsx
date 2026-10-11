'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@workspace/ui/lib/utils'
import { SignedIn } from '@/components/shell/signed-in'
import { Overline } from '@/components/ui/text'
import { accountAppointments, queueLive, sessionFor, today } from '@/lib/data'
import type { Account, Patient } from '@/lib/data'
import { ArtSwitch, useArtKind } from '@/components/care-art/art-switch'
import { CareArt } from '@/components/care-art/care-art'
import type { CareArtHandle } from '@/components/care-art/care-art'
import type { ArtKind } from '@/components/care-art/types'
import { openSoon, subline, todaysQueue, upcomingVisits } from './dashboard'
import { NextVisitCard } from './next-visit-card'
import { PriorityCard } from './priority-card'
import { QueueCard } from './queue-card'
import { QuickSearch } from './quick-search'
import { ComingUp, Family, OpenToday, YourDoctors } from './sections'

const INTRO_KEY = 'findcare.introSeen'

// How each artwork sits behind the page. The diagram fills the screen; the cell and the heart are
// single objects, drawn smaller (the cell at the design's 62%) and a little lower, so they clear the
// switch above them. Faded on phones, where the cards cover them.
const ART_FIT: Record<ArtKind, string> = {
  pathways: 'scale-[.66] translate-y-[6%] opacity-30 min-[1100px]:scale-[.66] min-[1100px]:opacity-75',
  cell: 'scale-[.62] translate-y-[6%] opacity-50 min-[1100px]:opacity-100',
  heart: 'scale-[.7] translate-y-[6%] opacity-50 min-[1100px]:opacity-100',
}

/**
 * The intro plays once per browser — the art draws in, then the greeting, then the cards — and again
 * whenever the address asks for it with ?intro=1. Never with reduced motion.
 */
function useIntro() {
  const replay = useSearchParams().get('intro') === '1'
  const [play] = useState(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    if (replay) return true
    try {
      return localStorage.getItem(INTRO_KEY) !== '1'
    } catch {
      return false
    }
  })
  const [stage, setStage] = useState(play ? 0 : 3)
  useEffect(() => {
    if (!play) return
    try {
      localStorage.setItem(INTRO_KEY, '1')
    } catch {
      // storage blocked: the intro may play again next time
    }
    const timers = [window.setTimeout(() => setStage(1), 1500), window.setTimeout(() => setStage(2), 2200), window.setTimeout(() => setStage(3), 3000)]
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [play])
  return { play, stage }
}

/** Reveal classes for an intro stage: hidden and lowered until its stage arrives. */
const reveal = (stage: number, at: number) =>
  cn('transition-[opacity,transform] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]', stage >= at ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0')

export function MyCareScreen() {
  return <SignedIn>{(me) => <Dashboard {...me} />}</SignedIn>
}

function Dashboard({ account, holder }: { account: Account; holder: Patient }) {
  const { play, stage } = useIntro()
  const [art, setArt] = useArtKind()
  const artRef = useRef<CareArtHandle>(null)

  const upcoming = upcomingVisits(account)
  const next = upcoming.at(0)
  const queue = todaysQueue(account)
  const hasHistory = account.saved.length > 0 || accountAppointments(account.id).some((a) => a.date < today())
  usePulses(artRef, queue ? queueLive(sessionFor(queue.sessionId)).serving : 0)

  const firstName = holder.name.split(' ')[0] || 'there'
  const greeting = new Date().getHours() < 12 ? 'Good morning,' : new Date().getHours() < 17 ? 'Good afternoon,' : 'Good evening,'

  const actions = (
    <div className={cn('flex flex-col gap-[22px]', reveal(stage, 2))}>
      <PriorityCard account={account} />
      <NextVisitCard account={account} visit={next} hasHistory={hasHistory} />
      {queue ? <QueueCard account={account} visit={queue} /> : <OpenToday />}
    </div>
  )
  const lists = (
    <div className={cn('flex flex-col gap-[22px]', reveal(stage, 2))}>
      <ComingUp account={account} visits={upcoming.slice(1)} />
      <YourDoctors account={account} />
      <Family account={account} />
    </div>
  )

  return (
    // One page that scrolls like every other: the art stays fixed behind it, the side columns flow,
    // and on wide screens the search stays to hand at the bottom of the centre column.
    <main className="relative grid w-full grid-cols-[minmax(0,1fr)] gap-x-7 gap-y-[22px] px-[var(--page-pad)] pt-5 pb-28 min-[760px]:pb-16 min-[1100px]:grid-cols-[clamp(300px,23vw,344px)_minmax(0,1fr)_clamp(300px,23vw,344px)] min-[1100px]:grid-rows-[auto_1fr] min-[1100px]:px-7 min-[1100px]:pt-6 min-[1100px]:pb-[22px]">
      <div className="pointer-events-none fixed inset-0 -z-[1]">
        <CareArt
          ref={artRef}
          kind={art}
          intro={play}
          className={cn('absolute inset-0 transition-opacity duration-500', ART_FIT[art])}
        />
      </div>
      <ArtSwitch
        value={art}
        onChange={setArt}
        className={cn(
          'absolute top-5 right-[var(--page-pad)] z-[3] min-[1100px]:top-6 min-[1100px]:right-auto min-[1100px]:left-1/2 min-[1100px]:-translate-x-1/2',
          reveal(stage, 1),
        )}
      />

      <header className={cn('relative z-[2] pt-12 min-[1100px]:col-start-1 min-[1100px]:row-start-1 min-[1100px]:pt-0', reveal(stage, 1))}>
        <Overline size="lg">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</Overline>
        <h1 className="mt-3 text-[28px] leading-[1.05] font-normal tracking-[-0.02em] text-ink-500">
          {greeting}
          <br />
          <span className="font-semibold text-ink-900">{firstName}.</span>
        </h1>
        <p className="mt-2.5 text-[13px] leading-normal text-ink-600 text-pretty">{subline(account)}</p>
      </header>

      <div className="relative z-[2] min-[1100px]:col-start-1 min-[1100px]:row-start-2">{actions}</div>
      <div
        className={cn(
          'relative z-[2] flex justify-center min-[1100px]:sticky min-[1100px]:bottom-[22px] min-[1100px]:col-start-2 min-[1100px]:row-span-2 min-[1100px]:row-start-1 min-[1100px]:self-end',
          reveal(stage, 1),
        )}
      >
        <QuickSearch />
      </div>
      <div className="relative z-[2] min-[1100px]:col-start-3 min-[1100px]:row-start-2">{lists}</div>
    </main>
  )
}

/**
 * The art answers what actually happens: a heartbeat when the queue moves on, and a softer one when
 * a doctor in "Open today" gets a new first opening. Nothing is invented to make it move.
 */
function usePulses(artRef: React.RefObject<CareArtHandle | null>, serving: number) {
  const lastServing = useRef(serving)
  const opening = openSoon()
    .map((r) => r.key + r.time)
    .join('|')
  const lastOpening = useRef(opening)
  useEffect(() => {
    if (serving !== lastServing.current) artRef.current?.pulse('queue', 0)
    lastServing.current = serving
  }, [serving, artRef])
  useEffect(() => {
    if (opening !== lastOpening.current) artRef.current?.pulse('slot', 1 + (opening.length % 2))
    lastOpening.current = opening
  }, [opening, artRef])
}
