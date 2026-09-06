import { useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { ArrowRight, Clock, MapPin } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { RichText } from '@workspace/ui/components/rich-text'
import { Segmented, SegmentedItem } from '@workspace/ui/components/segmented'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { useMembership } from '@/features/shell/queries'
import { agendaFromHtml, agendaToHtml, fmtRange, myRsvp, recurrenceLabel, shortDate, toIso } from './logic'
import { PersonAvatar, RsvpBadge, useCalendarMap, usePeopleMap } from './meeting-bits'
import { useMe, useMeetingActions, useMeetings } from './queries'
import { RescheduleDialog } from './reschedule-dialog'
import type { Rsvp } from './types'

/**
 * One meeting: what, when, where, the actions the viewer may take (join, reschedule, cancel), its
 * agenda and notes, the viewer's reply and everyone invited with theirs.
 */
export function MeetingDetailPage() {
  const { id } = useSearch({ from: '/_app/$app/$section' })
  const meetings = useMeetings()
  const cals = useCalendarMap()
  const people = usePeopleMap()
  const me = useMe()
  const membership = useMembership()
  const actions = useMeetingActions()
  const toast = useToast()
  const [resched, setResched] = useState(false)
  const [agendaDraft, setAgendaDraft] = useState<string | null>(null)
  const m = meetings.find((x) => x.id === id) ?? meetings[0]
  const cal = cals[m.calendar]
  const mine = myRsvp(m, me.key)
  const editable = membership?.role === 'Admin' || m.organiser === me.key
  const going = m.attendees.filter((a) => a.rsvp === 'yes').length
  const organiser = people[m.organiser]

  function setRsvp(v: Rsvp) {
    actions.setRsvp(m.id, me.key, v)
    toast(v === 'yes' ? 'You’re going' : v === 'maybe' ? 'Marked as maybe' : 'Declined — organiser notified', { ok: v !== 'no' })
  }
  function saveAgenda() {
    actions.setAgenda(m.id, agendaFromHtml(agendaDraft ?? ''))
    setAgendaDraft(null)
    toast('Agenda saved — attendees see it now')
  }
  function toggleCancel() {
    const was = !!m.cancelled
    const undo = actions.setCancelled(m.id, !was)
    toast(was ? 'Meeting restored' : 'Meeting cancelled — attendees notified', { ok: was, undo: was ? undefined : () => undo() })
  }

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-[30px] pb-24">
        <div className="mb-[18px] flex items-center gap-[9px] text-compact text-muted-foreground">
          <Link to="/$app" params={{ app: 'calendar' }} className="hover:text-foreground hover:underline">
            Calendar
          </Link>
          <span className="text-faint">/</span>
          <span className="font-bold text-foreground">{m.title}</span>
        </div>

        <div className="grid items-start gap-[18px] xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.95fr)]">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="border-b border-divider px-7 pt-[26px] pb-[22px]">
              <div className="mb-3.5 flex flex-wrap items-center gap-[9px]">
                <Badge variant={cal.tone} size="sm">
                  {cal.label}
                </Badge>
                {m.repeats && (
                  <Badge variant="neutral" size="sm">
                    {recurrenceLabel(m.repeats)}
                  </Badge>
                )}
                {m.cancelled && (
                  <Badge variant="risk" size="sm">
                    Cancelled
                  </Badge>
                )}
                {m.moved && !m.cancelled && (
                  <Badge variant="warning" size="sm">
                    Rescheduled
                  </Badge>
                )}
              </div>
              <h1 className="text-[29px] leading-[1.15] font-medium tracking-[-0.024em] text-pretty text-foreground">{m.title}</h1>
              <div className="mt-[18px] flex flex-wrap items-center gap-[22px]">
                <div className="flex items-center gap-2.5">
                  <Clock className="size-[17px] text-faint" strokeWidth={1.6} />
                  <span className="text-ui font-bold tabular-nums text-body">
                    {shortDate(m.date)} · {fmtRange(m.start, m.end)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin className="size-[17px] text-faint" strokeWidth={1.6} />
                  <span className="text-ui text-body">{m.room} · Hexa Meet link</span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Button onClick={() => toast(`Opening ${m.room} call…`)}>
                  Join call
                  <ButtonArrow>
                    <ArrowRight strokeWidth={2} />
                  </ButtonArrow>
                </Button>
                {editable && !m.cancelled && (
                  <Button variant="outline" onClick={() => setResched(true)}>
                    Reschedule
                  </Button>
                )}
                {editable && (
                  <Button variant="outline" className={cn(!m.cancelled && 'text-tone-risk-foreground shadow-[inset_0_0_0_1px_var(--tone-risk-soft)]')} onClick={toggleCancel}>
                    {m.cancelled ? 'Restore meeting' : 'Cancel meeting'}
                  </Button>
                )}
                {!editable && (
                  <Badge variant="neutral">{organiser?.name} organises this — ask them to move it</Badge>
                )}
              </div>
            </div>
            <div className="grid gap-[30px] px-7 pt-6 pb-[26px] md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="text-ui-sm font-bold text-muted-foreground">Agenda</div>
                  {editable && m.agenda.length > 0 && agendaDraft === null && (
                    <Button variant="link" size="xs" onClick={() => setAgendaDraft(agendaToHtml(m.agenda))} className="ms-auto text-fine">
                      Edit
                    </Button>
                  )}
                </div>
                {agendaDraft !== null ? (
                  <div className="mt-3">
                    <RichText value={agendaDraft} onChange={setAgendaDraft} autoFocus placeholder="One item per line, with its minutes — “Blockers worth a room · 10 min”." />
                    <div className="mt-2.5 flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setAgendaDraft(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={saveAgenda}>
                        Save agenda
                      </Button>
                    </div>
                  </div>
                ) : m.agenda.length ? (
                  <ol className="mt-1.5">
                    {m.agenda.map((a, i) => (
                      <li key={i} className={cn('grid grid-cols-[26px_minmax(0,1fr)_auto] gap-3 py-[13px]', i > 0 && 'border-t border-divider')}>
                        <span className="pt-0.5 text-xs font-bold tabular-nums text-faint">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-ui leading-[1.55] text-pretty text-body">{a.text}</span>
                        <span className="pt-[3px] text-xs whitespace-nowrap text-faint">{a.minutes}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface-band px-[18px] py-4">
                    <span className="text-ui-sm text-muted-foreground">No agenda yet. Meetings without one run 20% longer.</span>
                    {editable && (
                      <Button variant="outline" size="sm" onClick={() => setAgendaDraft('')}>
                        Add agenda
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-ui-sm font-bold text-muted-foreground">Notes</div>
                <p className="mt-[11px] text-ui leading-[1.65] text-pretty text-body">{m.notes || 'No notes yet. Whatever gets decided here should end up in one line, in this box, before the room empties.'}</p>
              </div>
            </div>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <Card className="gap-0 p-5">
              <Segmented className="flex w-full">
                {(['yes', 'maybe', 'no'] as Rsvp[]).map((v) => (
                  <SegmentedItem key={v} active={mine === v} className="flex-1" onClick={() => setRsvp(v)}>
                    {mine === v && <span aria-hidden="true">✓</span>}
                    {v === 'yes' ? 'Going' : v === 'maybe' ? 'Maybe' : 'Can’t make it'}
                  </SegmentedItem>
                ))}
              </Segmented>
              <div className="mt-[11px] text-meta text-muted-foreground">{mine === 'pending' || mine === 'none' ? `You haven’t replied. ${organiser?.name} is waiting.` : `${going} of ${m.attendees.length} have accepted so far.`}</div>
            </Card>
            <Card className="gap-0 px-5 pt-5 pb-2">
              <div className="mb-1.5 flex items-baseline justify-between gap-2.5">
                <span className="text-meta font-bold tracking-[0.1em] text-foreground uppercase">Attendees</span>
                <span className="text-xs text-faint">
                  {going} going · {m.attendees.length} invited
                </span>
              </div>
              {m.attendees.map((a, i) => {
                const p = people[a.person]
                return (
                  <div key={a.person} className={cn('flex items-center gap-[11px] py-[11px]', i > 0 && 'border-t border-divider')}>
                    <PersonAvatar person={p} highlight={a.person === me.key} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ui-sm font-bold text-foreground">
                        {p?.name}
                        {a.person === m.organiser ? ' · organiser' : ''}
                      </span>
                      <span className="block text-fine text-faint">{p?.role}</span>
                    </span>
                    <RsvpBadge rsvp={a.rsvp} />
                  </div>
                )
              })}
            </Card>
          </div>
        </div>
      </div>
      {resched && <RescheduleDialog meeting={m} today={toIso(new Date())} onClose={() => setResched(false)} />}
    </div>
  )
}
