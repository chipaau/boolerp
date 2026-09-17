import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronRight, X } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { MiniCalendar } from '@workspace/ui/components/mini-calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { RichText } from '@workspace/ui/components/rich-text'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { holidayForEveryone, holidayOn, unitChain } from '@/features/org/logic'
import { useHolidays, usePeople as useOrgPeople, useUnits } from '@/features/org/queries'
import { DAY_END, DAY_START, RECURRENCES, addMonths, agendaFromHtml, firstOfMonth, fmtDuration, fmtTime, fromMinutes, isPersonFree, isRoomFree, meetingsOn, roomBusy, shortDate, suggestSlots, toMinutes } from './logic'
import { HexDot, PersonAvatar, TONE } from './meeting-bits'
import { useCalendars, useHolidayMap, useMe, useMeetingActions, useMeetings, usePeople, useRooms } from './queries'
import type { CalendarKey, Meeting, Recurrence } from './types'

export type NewMeetingDraft = { date: string; start: string; duration: number; room?: string }

/**
 * The new-meeting sheet from the design: title, calendar, a "When" row whose popover holds the date picker,
 * start/end, all-day, repeats and time suggestions, the room with live availability, attendees
 * with search, and the agenda in a rich-text editor. "Send invites" adds the meeting and offers an undo.
 */
export function NewMeetingDialog({ draft, today, onClose }: { draft: NewMeetingDraft | null; today: string; onClose: () => void }) {
  const meetings = useMeetings()
  const calendars = useCalendars()
  const rooms = useRooms()
  const people = usePeople()
  const me = useMe()
  const actions = useMeetingActions()
  const toast = useToast()

  const [title, setTitle] = useState('Design review — mobile scan flow')
  const [calendar, setCalendar] = useState<CalendarKey>('team')
  const [date, setDate] = useState(today)
  const [start, setStart] = useState('16:00')
  const [duration, setDuration] = useState(45)
  const [allDay, setAllDay] = useState(false)
  const [repeats, setRepeats] = useState<Recurrence>('')
  const [room, setRoom] = useState('Hive 2')
  const [invites, setInvites] = useState<string[]>(['JL', 'PR', 'HY'])
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState('')
  const [whenOpen, setWhenOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(today)

  // each time the dialog opens, take the draft (a dragged slot, a room gap, a day's "+")
  useEffect(() => {
    if (!draft) return
    setDate(draft.date)
    setStart(draft.start)
    setDuration(draft.duration)
    if (draft.room) setRoom(draft.room)
    setPickerMonth(firstOfMonth(draft.date))
    setWhenOpen(false)
  }, [draft])

  const s = toMinutes(start), e = s + duration
  const everyone = useMemo(() => [me.key, ...invites.filter((k) => k !== me.key)], [invites, me.key])
  const roomOk = isRoomFree(meetings, room, date, s, e)
  const busyCount = everyone.filter((k) => !isPersonFree(meetings, k, date, s, e)).length
  const roomDef = rooms.find((r) => r.name === room) ?? rooms[0]
  const slots = useMemo(() => suggestSlots(meetings, everyone, date, duration), [meetings, everyone, date, duration])
  const suggestions = people.filter((p) => query.trim() && p.key !== me.key && !invites.includes(p.key) && p.name.toLowerCase().includes(query.trim().toLowerCase()))
  const marks = useMemo(() => Object.fromEntries([...new Set(meetings.map((m) => m.date))].map((d) => [d, meetingsOn(meetings, d).length])), [meetings])
  const when = `${shortDate(date)} · ${fmtTime(start)} – ${fmtTime(fromMinutes(e))}`
  const dayHoliday = useHolidayMap()[date]
  const holiday = dayHoliday && holidayForEveryone(dayHoliday) ? dayHoliday : undefined
  const holidays = useHolidays()
  const orgPeople = useOrgPeople()
  const units = useUnits()
  // a holiday narrowed to some units or sites only matters when it covers someone invited
  const invitedHoliday = useMemo(() => {
    if (holiday) return undefined
    for (const k of everyone) {
      const p = orgPeople.find((x) => x.id === k)
      if (!p) continue
      const h = holidayOn(holidays, date, { units: unitChain(units, p.unitId).map((u) => u.id), site: p.primarySite })
      if (h) return { holiday: h, name: p.name }
    }
    return undefined
  }, [holiday, everyone, orgPeople, holidays, units, date])
  const agendaCount = useMemo(() => agendaFromHtml(notes).length, [notes])

  function create() {
    const meeting: Meeting = {
      id: `m${Date.now().toString(36)}`,
      title: title.trim() || 'Untitled meeting',
      date,
      start: allDay ? fromMinutes(DAY_START * 60) : start,
      end: allDay ? fromMinutes(DAY_END * 60) : fromMinutes(e),
      calendar,
      room,
      organiser: me.key,
      repeats,
      attendees: everyone.map((k) => ({ person: k, rsvp: k === me.key ? 'yes' : 'pending' })),
      agenda: agendaFromHtml(notes),
      notes: '',
    }
    const undo = actions.create(meeting)
    onClose()
    toast(`Invites sent to ${invites.length} people`, { undo: () => { undo(); toast('Meeting withdrawn', { ok: false }) } })
  }

  return (
    <Dialog open={draft !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[660px]" showCloseButton={false}>
        <DialogHeader className="flex-row items-center justify-between gap-3.5 border-b border-divider px-6 pt-[22px] pb-4 text-left">
          <div>
            <DialogTitle className="text-h3 tracking-[-0.015em]">New meeting</DialogTitle>
            <DialogDescription className="mt-1 text-compact text-muted-foreground">
              {when} · you and {invites.length} others
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </DialogHeader>

        <div className="max-h-[min(74vh,620px)] overflow-y-auto px-6 pt-5 pb-3">
          <Input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="What is this meeting for?" className="h-10 rounded-[10px] bg-surface-band text-sm" />
          {holiday && (
            <div role="status" className="mt-3 rounded-[10px] bg-tone-warning-soft px-[13px] py-2.5 text-compact leading-[1.5] text-tone-warning-foreground">
              {shortDate(date)} is {holiday.name}{holiday.halfDay ? ' (half day)' : ''}. People may be off — you can still send it.
            </div>
          )}
          {invitedHoliday && (
            <div role="status" className="mt-3 rounded-[10px] bg-tone-warning-soft px-[13px] py-2.5 text-compact leading-[1.5] text-tone-warning-foreground">
              {shortDate(date)} is {invitedHoliday.holiday.name} for {invitedHoliday.name}{invitedHoliday.holiday.halfDay ? ' (half day)' : ''}. They may be off — you can still send it.
            </div>
          )}

          <Label className="mt-5 mb-2 text-meta font-bold text-muted-foreground">Calendar</Label>
          <div className="flex flex-wrap gap-[7px]">
            {calendars.map((c) => (
              <Pill key={c.key} active={calendar === c.key} onClick={() => setCalendar(c.key)}>
                <span className={cn('size-2 rounded-full', TONE[c.tone].dot)} />
                {c.label}
              </Pill>
            ))}
          </div>

          <Label className="mt-5 mb-2 text-meta font-bold text-muted-foreground">When</Label>
          <div className="rounded-xl bg-surface-band px-4 pt-1.5 pb-3">
            <Popover open={whenOpen} onOpenChange={setWhenOpen}>
              <PopoverTrigger className="group flex w-full items-center gap-2.5 rounded-[9px] px-1 py-[11px] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <CalendarDays className="size-4 fill-transparent text-faint transition-colors duration-instant group-hover:fill-primary group-hover:text-foreground group-data-popup-open:fill-primary group-data-popup-open:text-foreground" strokeWidth={1.6} />
                <span className="min-w-0 flex-1 text-ui-sm font-bold tabular-nums text-foreground group-hover:font-black group-data-popup-open:font-black">{allDay ? `All day · ${shortDate(date)}` : `${when} · ${fmtDuration(duration)}`}</span>
                <ChevronDown className={cn('size-4 text-faint transition-transform duration-quick', whenOpen && 'rotate-180')} />
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-(--anchor-width) max-h-[min(62vh,540px)] overflow-y-auto p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="mb-[5px] text-micro text-faint">Start date</div>
                    <Popover>
                      <PopoverTrigger className="flex h-[34px] w-full items-center justify-between gap-2 rounded-[9px] bg-surface-band pr-2.5 pl-[11px] text-left text-sm font-bold tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span>{shortDate(date)}</span>
                        <CalendarDays className="size-[15px] text-faint" strokeWidth={1.6} />
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[252px] p-3">
                        <MiniCalendar compact month={pickerMonth} selected={date} today={today} marks={marks} onSelect={(d) => setDate(d)} onMonthChange={(d) => setPickerMonth(addMonths(pickerMonth, d))} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className={cn(allDay && 'pointer-events-none opacity-35')}>
                    <div className="mb-[5px] text-micro text-faint">Start time</div>
                    <NativeSelect value={start} onChange={(ev) => setStart(ev.target.value)}>
                      {times(DAY_START * 60, DAY_END * 60 - 15).map((t) => (
                        <option key={t} value={t}>
                          {fmtTime(t)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className={cn(allDay && 'pointer-events-none opacity-35')}>
                    <div className="mb-[5px] text-micro text-faint">End time</div>
                    <NativeSelect value={fromMinutes(e)} onChange={(ev) => setDuration(Math.max(15, toMinutes(ev.target.value) - s))}>
                      {times(s + 15, DAY_END * 60).map((t) => (
                        <option key={t} value={t}>
                          {fmtTime(t)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 rounded-lg py-1 pr-2.5 pl-1 text-compact text-body">
                    <Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(!!v)} /> All day
                  </label>
                  <label className="flex items-center gap-2 rounded-lg py-1 pr-2.5 pl-1 text-compact text-body">
                    <Checkbox checked={!!repeats} onCheckedChange={(v) => setRepeats(v ? 'Weekly' : '')} /> Repeats
                  </label>
                  {repeats && (
                    <NativeSelect value={repeats} onChange={(ev) => setRepeats(ev.target.value as Recurrence)} className="w-[132px] [&>select]:h-[30px] [&>select]:text-meta">
                      {RECURRENCES.filter((r) => r.value).map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </div>
                <div className="mt-[18px] border-t border-divider pt-4">
                  <div className="mb-2.5 flex items-center gap-[9px]">
                    <CalendarDays className="size-4 text-faint" strokeWidth={1.6} />
                    <span className="text-compact font-bold text-foreground">Time suggestions</span>
                    <span className="text-fine text-faint">for the {everyone.length} people invited below</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {slots.map((sl) => {
                      const on = start === fromMinutes(sl.s)
                      const all = sl.free === everyone.length
                      return (
                        <button
                          key={sl.s}
                          type="button"
                          onClick={() => setStart(fromMinutes(sl.s))}
                          className={cn('grid w-full grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] px-3.5 py-[11px] text-left outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring', on ? 'bg-surface-soft shadow-[inset_0_0_0_1px_var(--brand-soft)]' : 'shadow-[inset_0_0_0_1px_var(--divider)] hover:bg-surface-soft')}
                        >
                          <span className="text-compact font-bold text-foreground">{shortDate(date)}</span>
                          <span className="text-compact tabular-nums text-body">
                            {fmtTime(fromMinutes(sl.s))} – {fmtTime(fromMinutes(sl.e))} ({fmtDuration(sl.e - sl.s)})
                          </span>
                          <Badge variant={all ? 'success' : 'warning'} size="sm">
                            {all ? 'All free' : `${sl.free} of ${everyone.length} free`}
                          </Badge>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className={cn('mt-3 px-1 text-meta font-bold tabular-nums', roomOk && !busyCount ? 'text-muted-foreground' : 'text-tone-risk-foreground')}>
              {allDay
                ? roomOk ? `${room} is free all day` : `${room} is taken that day`
                : `${roomOk ? `${room} is free` : `${room} is taken then`}${busyCount ? ` · ${busyCount} invited ${busyCount === 1 ? 'person is' : 'people are'} busy` : ' · everyone invited is free'}`}
            </div>
          </div>

          <Label className="mt-5 mb-2 text-meta font-bold text-muted-foreground">Room</Label>
          <Popover>
            <PopoverTrigger className="flex w-full items-center gap-[11px] rounded-[10px] bg-surface-band px-[13px] py-[9px] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring data-popup-open:shadow-[inset_0_0_0_1px_var(--brand-soft)]">
              <span className={cn('size-2 shrink-0 rounded-full', roomOk ? 'bg-tone-success' : 'bg-tone-risk')} />
              <span className="min-w-0 flex-1">
                <span className="block text-ui-sm font-bold text-foreground">{room}</span>
                <span className="mt-0.5 block text-fine text-faint">
                  {roomDef.capacity} seats · {roomDef.kit} · {roomOk ? `free at ${fmtTime(start)}` : `booked at ${fmtTime(start)}`}
                </span>
              </span>
              <ChevronDown className="size-3 text-faint" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-(--anchor-width) p-2">
              <div className="px-[11px] pt-[3px] pb-2 text-[10.5px] font-bold tracking-[0.1em] text-faint uppercase">Meeting rooms</div>
              {rooms.map((r) => {
                const ok = isRoomFree(meetings, r.name, date, s, e)
                const next = roomBusy(meetings, r.name, date).at(0)
                return (
                  <button key={r.name} type="button" onClick={() => setRoom(r.name)} className="flex w-full items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-left outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                    <span className={cn('size-2 shrink-0 rounded-full', ok ? 'bg-tone-success' : 'bg-tone-risk')} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-ui-sm font-bold text-foreground">{r.name}</span>
                      <span className="mt-0.5 block text-fine text-faint">
                        {r.capacity} seats · {r.kit} · {next ? `next booking ${fmtTime(next.start)}` : 'nothing booked'}
                      </span>
                    </span>
                    <Badge variant={ok ? 'success' : 'risk'} size="sm">
                      {ok ? 'Free' : 'Taken'}
                    </Badge>
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>

          <Label className="mt-5 mb-2 text-meta font-bold text-muted-foreground">Attendees</Label>
          <div className="flex flex-wrap items-center gap-[7px] rounded-[10px] bg-surface-band px-2.5 py-[9px]">
            {invites.map((k) => {
              const p = people.find((x) => x.key === k)
              return (
                <button key={k} type="button" onClick={() => setInvites((l) => l.filter((x) => x !== k))} className="inline-flex items-center gap-[7px] rounded-full bg-card py-1 pr-[9px] pl-1 text-meta font-bold text-body outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <PersonAvatar person={p} className="size-[22px]" />
                  {p?.name.split(' ')[0]}
                  <X className="size-3 text-faint" />
                </button>
              )
            })}
            <input value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="Add someone…" className="h-7 min-w-[110px] flex-1 bg-transparent text-ui-sm text-foreground outline-none placeholder:text-placeholder" />
          </div>
          {suggestions.length > 0 && (
            <div className="mt-1.5 rounded-[10px] bg-surface-band p-1">
              {suggestions.map((p) => (
                <button key={p.key} type="button" onClick={() => { setInvites((l) => [...l, p.key]); setQuery('') }} className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                  <PersonAvatar person={p} className="size-6" />
                  <span className="text-ui-sm text-body">{p.name}</span>
                  <span className="ms-auto text-fine text-faint">{p.role}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 border-t border-divider">
            <button type="button" onClick={() => setNotesOpen((o) => !o)} className="flex w-full items-center gap-2.5 rounded-[9px] px-0.5 py-3 text-left outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronRight className={cn('size-3.5 text-faint transition-transform duration-quick', notesOpen && 'rotate-90')} />
              <span className="text-ui-sm font-bold text-foreground">Agenda</span>
              <span className="ms-auto text-xs text-faint">{agendaCount ? `${agendaCount} ${agendaCount === 1 ? 'item' : 'items'}` : 'Empty'}</span>
            </button>
            {notesOpen && <RichText value={notes} onChange={setNotes} autoFocus placeholder="One item per line, with its minutes — “Blockers worth a room · 10 min”." className="mb-3.5" />}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-divider px-6 pt-[15px] pb-[18px]">
          <span className="min-w-0 flex-1 text-meta text-muted-foreground">{when} · invites go out immediately</span>
          <div className="flex items-center gap-[9px]">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={create}>
              Send invites
              <ButtonArrow />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A choice chip: the Badge filter pill rendered as a button, the chosen one in the primary sand. */
function Pill({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Badge variant="filter" render={<button type="button" onClick={onClick} aria-pressed={active} />} className={cn('h-8 px-[13px] text-meta', active && 'bg-primary text-foreground hover:bg-primary')}>
      {children}
    </Badge>
  )
}

function times(from: number, to: number) {
  const out: string[] = []
  for (let m = from; m <= to; m += 15) out.push(fromMinutes(m))
  return out
}

export { HexDot }
