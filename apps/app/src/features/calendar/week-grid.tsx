import { useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card } from '@workspace/ui/components/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@workspace/ui/components/tooltip'
import { cn } from '@workspace/ui/lib/utils'
import { DAY_END, DAY_START, HOUR_PX, addDays, dayOfMonth, fmtTime, fromMinutes, isWeekend, meetingsOn, packLanes, snap15, toMinutes, weekdayShort } from './logic'
import { MeetingHoverCard, TONE, useCalendarMap } from './meeting-bits'
import { useMe } from './queries'
import type { Meeting } from './types'

type Drag = { mode: 'create'; date: string; s: number; e: number } | { mode: 'move'; id: string; date: string; s: number; e: number }

const HOURS = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i)
const top = (mins: number) => ((mins - DAY_START * 60) / 60) * HOUR_PX

/**
 * Seven (or five) day columns over an hour ruler, 8am to 7pm. Meetings are placed absolutely and
 * packed side by side when they overlap; the red line is now on today's column. Drag on empty
 * time to draft a meeting; drag a meeting you organise to move it.
 */
export function WeekGrid({
  meetings,
  start,
  days,
  selected,
  today,
  nowMinutes,
  onSelect,
  onCreate,
  onMove,
}: {
  meetings: Meeting[]
  start: string
  days: 5 | 7
  selected: string
  today: string
  nowMinutes: number
  onSelect: (iso: string) => void
  onCreate: (iso: string, start: string, duration: number) => void
  onMove: (m: Meeting, date: string, start: string, end: string) => void
}) {
  const cals = useCalendarMap()
  const me = useMe()
  const navigate = useNavigate()
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const suppressClick = useRef(0)
  const cols = Array.from({ length: days }, (_, i) => addDays(start, i))

  function setD(d: Drag | null) {
    dragRef.current = d
    setDrag(d)
  }

  function startCreate(iso: string, e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-ev]')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const a = snap15(DAY_START * 60 + ((e.clientY - rect.top) / HOUR_PX) * 60)
    setD({ mode: 'create', date: iso, s: a, e: Math.min(DAY_END * 60, a + 30) })
    const move = (ev: PointerEvent) => {
      const b = snap15(DAY_START * 60 + ((ev.clientY - rect.top) / HOUR_PX) * 60)
      const s = Math.min(a, b)
      setD({ mode: 'create', date: iso, s, e: Math.max(a, b, s + 15) })
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      const d = dragRef.current
      setD(null)
      if (d && d.mode === 'create') onCreate(d.date, fromMinutes(d.s), Math.max(15, d.e - d.s))
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  function startMove(m: Meeting, e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0 || m.organiser !== me.key) return
    e.stopPropagation()
    const colRect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    const x0 = e.clientX, y0 = e.clientY
    const s0 = toMinutes(m.start), len = toMinutes(m.end) - s0
    const startIndex = cols.indexOf(m.date)
    let dragged = false
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - y0) > 4 || Math.abs(ev.clientX - x0) > 4) dragged = true
      if (!dragged) return
      const dm = Math.round(((ev.clientY - y0) / HOUR_PX) * 60 / 15) * 15
      const dc = Math.round((ev.clientX - x0) / colRect.width)
      const idx = Math.max(0, Math.min(cols.length - 1, startIndex + dc))
      const s = Math.max(DAY_START * 60, Math.min(DAY_END * 60 - len, s0 + dm))
      setD({ mode: 'move', id: m.id, date: cols[idx], s, e: s + len })
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      const d = dragRef.current
      setD(null)
      if (!dragged || !d || d.mode !== 'move') return
      suppressClick.current = Date.now()
      if (d.date !== m.date || d.s !== s0) onMove(m, d.date, fromMinutes(d.s), fromMinutes(d.e))
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="grid border-b border-divider bg-surface-band" style={{ gridTemplateColumns: `56px repeat(${days}, minmax(0, 1fr))` }}>
        <div />
        {cols.map((iso) => {
          const isToday = iso === today
          return (
            <button key={iso} type="button" onClick={() => onSelect(iso)} className="border-l border-divider px-2 py-[9px] pb-2.5 text-center outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
              <div className="text-[10.5px] font-bold tracking-[0.11em] text-faint uppercase">{weekdayShort(iso)}</div>
              <div
                className={cn(
                  'mx-auto mt-[5px] grid size-7 place-items-center rounded-full text-ui-lg tabular-nums',
                  isToday ? 'bg-brand-soft font-bold text-brand-cta-foreground' : iso === selected ? 'bg-primary font-bold text-foreground' : 'text-foreground'
                )}
              >
                {dayOfMonth(iso)}
              </div>
            </button>
          )
        })}
      </div>
      <div className="max-h-[calc(100svh-340px)] overflow-y-auto">
        <TooltipProvider delay={200}>
          <div className="grid pt-[9px]" style={{ gridTemplateColumns: `56px repeat(${days}, minmax(0, 1fr))` }}>
            <div className="relative">
              {HOURS.map((h) => (
                <div key={h} className="-translate-y-[7px] pr-2.5 text-right text-micro tabular-nums text-faint" style={{ height: HOUR_PX }}>
                  {fmtTime(`${String(h).padStart(2, '0')}:00`)}
                </div>
              ))}
            </div>
            {cols.map((iso) => {
              const placed = packLanes(meetingsOn(meetings, iso))
              const ghost = drag && drag.date === iso ? drag : null
              return (
                <div
                  key={iso}
                  onPointerDown={(e) => startCreate(iso, e)}
                  className={cn('relative border-l border-divider select-none', isWeekend(iso) && 'bg-surface-band/60')}
                >
                  {HOURS.map((h) => (
                    <div key={h} className="border-b border-divider" style={{ height: HOUR_PX }} />
                  ))}
                  {iso === today && (
                    <div aria-hidden="true" className="absolute right-0 left-0 z-[6] border-t-[1.5px] border-tone-risk" style={{ top: top(nowMinutes) }}>
                      <span className="absolute -top-[3.5px] -left-[3px] size-[7px] rounded-full bg-tone-risk" />
                    </div>
                  )}
                  {ghost && (
                    <div
                      className="pointer-events-none absolute right-[3px] left-[3px] z-[8] grid place-items-center rounded-lg bg-brand-soft/20 text-micro font-bold tabular-nums text-tone-warning-foreground shadow-[inset_0_0_0_1.5px_var(--brand-soft)]"
                      style={{ top: top(ghost.s), height: Math.max(20, ((ghost.e - ghost.s) / 60) * HOUR_PX - 3) }}
                    >
                      {fmtTime(fromMinutes(ghost.s))} – {fmtTime(fromMinutes(ghost.e))}
                    </div>
                  )}
                  {placed.map(({ m, s, e, lane, lanes }) => {
                    const t = TONE[cals[m.calendar].tone]
                    const h = Math.max(26, ((e - s) / 60) * HOUR_PX - 3)
                    const w = 100 / lanes
                    const moving = drag?.mode === 'move' && drag.id === m.id
                    return (
                      <Tooltip key={m.id}>
                        <TooltipTrigger
                          data-ev=""
                          onPointerDown={(ev) => startMove(m, ev)}
                          onClick={() => {
                            if (Date.now() - suppressClick.current < 300) return
                            void navigate({ to: '/$app/$section', params: { app: 'calendar', section: 'meetings' }, search: { id: m.id } })
                          }}
                          className={cn(
                            'absolute overflow-hidden rounded-lg px-[7px] py-[5px] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            t.soft,
                            m.organiser === me.key ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                            m.cancelled && 'opacity-55 shadow-[0_0_0_1px_var(--divider)]',
                            moving && 'opacity-40'
                          )}
                          style={{ top: top(s), height: h, left: `calc(${lane * w}% + 3px)`, width: `calc(${w}% - 6px)`, touchAction: 'none' }}
                        >
                          <div className={cn('truncate text-fine leading-[1.25] font-bold', t.fg, m.cancelled && 'line-through')}>{m.title}</div>
                          {h >= 40 && (
                            <div className={cn('mt-0.5 truncate text-[10.5px] opacity-80', t.fg)}>
                              {fmtTime(m.start)} · {m.room}
                            </div>
                          )}
                        </TooltipTrigger>
                        <TooltipContent side="right" align="start" sideOffset={8} variant="card" showArrow={false}>
                          <MeetingHoverCard m={m} />
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </TooltipProvider>
      </div>
    </Card>
  )
}
