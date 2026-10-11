'use client'

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { cn } from '@workspace/ui/lib/utils'
import { IconButton } from '@/components/ui/icon-button'
import { DOW, MON, fmtDate } from '@/lib/data'

/** One day in the booking window: whether the doctor has a session, and whether any of it is still open. */
export type DayInfo = { date: string; has: boolean; open: boolean }

const utc = (date: string) => new Date(date + 'T00:00:00Z')
const describe = (d: DayInfo) => `${fmtDate(d.date)}, ${d.open ? 'open times' : d.has ? 'full' : 'no sessions'}`

/**
 * The next 60 days as a scrolling strip of pills, with a month calendar for jumping ahead. A dot marks
 * a day with open times; a day with sessions but nothing open stays pickable, faded, so its waitlist
 * is a tap away; a day with no sessions cannot be picked.
 */
export function DateStrip({ days, value, onPick }: { days: DayInfo[]; value: string; onPick: (date: string) => void }) {
  const strip = useRef<HTMLDivElement>(null)
  const first = useRef(true)

  // Keep the chosen day in view: jump there on load, glide there after.
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-date="${value}"]`)
    if (el && strip.current) strip.current.scrollTo({ left: Math.max(0, el.offsetLeft - 8), behavior: first.current ? 'auto' : 'smooth' })
    first.current = false
  }, [value])

  const scroll = (dx: number) => strip.current?.scrollBy({ left: dx, behavior: 'smooth' })

  return (
    <>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className="eyebrow text-ink-500">Availability</h2>
        <div className="flex items-center gap-1.5">
          <IconButton
            label="Earlier dates"
            size={34}
            onClick={() => scroll(-300)}
            className="hidden bg-white shadow-[inset_0_0_0_1px_rgba(30,10,24,.1)] hover:bg-indigo-50 min-[760px]:flex"
          >
            <ChevronLeft className="size-3.5" strokeWidth={2} />
          </IconButton>
          <IconButton
            label="Later dates"
            size={34}
            onClick={() => scroll(300)}
            className="hidden bg-white shadow-[inset_0_0_0_1px_rgba(30,10,24,.1)] hover:bg-indigo-50 min-[760px]:flex"
          >
            <ChevronRight className="size-3.5" strokeWidth={2} />
          </IconButton>
          <MonthPicker days={days} value={value} onPick={onPick} />
        </div>
      </div>
      <div ref={strip} className="relative -mx-1 flex snap-x snap-proximity gap-1.5 overflow-x-auto px-1 pt-1 pb-3.5 [scrollbar-width:none]">
        {days.map((d, i) => {
          const on = d.date === value
          const dt = utc(d.date)
          const newMonth = i === 0 || dt.getUTCDate() === 1
          return (
            <button
              key={d.date}
              type="button"
              data-date={d.date}
              disabled={!d.has}
              aria-pressed={on}
              aria-label={describe(d)}
              onClick={() => onPick(d.date)}
              className={cn(
                'flex h-[74px] w-[52px] shrink-0 snap-start flex-col items-center justify-center gap-[5px] rounded-full transition-[background-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                on ? 'bg-indigo-900 text-white shadow-[0_8px_18px_rgba(42,37,72,.25)]' : d.open ? 'bg-white text-ink-900 shadow-soft' : 'bg-transparent text-ink-900',
                d.has ? 'cursor-pointer' : 'cursor-default',
                !on && !d.open && (d.has ? 'opacity-55' : 'opacity-35'),
              )}
            >
              <span className={cn('text-[9px] font-medium tracking-[0.14em] uppercase', on ? 'text-indigo-300' : newMonth && i > 0 ? 'text-indigo-500' : 'text-ink-500')}>
                {i === 0 ? 'Today' : newMonth ? MON[dt.getUTCMonth()] : DOW[dt.getUTCDay()]}
              </span>
              <span className="text-[17px] leading-none font-semibold tabular-nums">{dt.getUTCDate()}</span>
              <span aria-hidden className={cn('size-1 rounded-full', d.open ? (on ? 'bg-white' : 'bg-rose-400') : 'bg-transparent')} />
            </button>
          )
        })}
      </div>
    </>
  )
}

/** A month at a time across the same 60 days, for jumping further than the strip scrolls comfortably. */
function MonthPicker({ days, value, onPick }: { days: DayInfo[]; value: string; onPick: (date: string) => void }) {
  const [open, setOpen] = useState(false)
  const t0 = utc(days[0].date)
  const last = utc(days[days.length - 1].date)
  const maxM = (last.getUTCFullYear() - t0.getUTCFullYear()) * 12 + last.getUTCMonth() - t0.getUTCMonth()
  const monthOf = (date: string) => {
    const d = utc(date)
    return Math.max(0, Math.min(maxM, (d.getUTCFullYear() - t0.getUTCFullYear()) * 12 + d.getUTCMonth() - t0.getUTCMonth()))
  }
  const [m, setM] = useState(() => monthOf(value))
  const info = new Map(days.map((d) => [d.date, d]))
  const m0 = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + m, 1))
  const daysInMonth = new Date(Date.UTC(m0.getUTCFullYear(), m0.getUTCMonth() + 1, 0)).getUTCDate()
  const prefix = m0.toISOString().slice(0, 8)

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setM(monthOf(value))
        setOpen(o)
      }}
    >
      <PopoverTrigger
        aria-label="Pick a date"
        className={cn(
          'flex h-[34px] cursor-pointer items-center gap-[7px] rounded-full px-3 text-[12.5px] font-medium shadow-[inset_0_0_0_1px_rgba(30,10,24,.1)] outline-none hover-outline focus-visible:ring-2 focus-visible:ring-indigo-500',
          open ? 'bg-indigo-900 text-white' : 'bg-white text-ink-900',
        )}
      >
        <CalendarDays aria-hidden className="size-3.5" strokeWidth={1.8} />
        Calendar
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Choose a date" className="w-[292px] gap-0 rounded-[20px] bg-white/98 p-3.5 text-ink-900 shadow-popover">
        <div className="flex items-center justify-between gap-2 px-0.5 pb-2.5">
          <IconButton label="Previous month" variant="ghost" size={30} disabled={m <= 0} onClick={() => setM(m - 1)} className="disabled:opacity-30">
            <ChevronLeft className="size-4" strokeWidth={1.8} />
          </IconButton>
          <span className="text-[14px] font-semibold">{m0.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
          <IconButton label="Next month" variant="ghost" size={30} disabled={m >= maxM} onClick={() => setM(m + 1)} className="disabled:opacity-30">
            <ChevronRight className="size-4" strokeWidth={1.8} />
          </IconButton>
        </div>
        <div aria-hidden className="grid grid-cols-7 gap-0.5 pb-1 text-center text-[10px] font-medium tracking-[0.12em] text-ink-500">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: m0.getUTCDay() }, (_, i) => (
            <span key={`pad${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, k) => {
            const date = prefix + String(k + 1).padStart(2, '0')
            const d = info.get(date)
            const ok = !!d?.has
            const on = date === value
            return (
              <button
                key={date}
                type="button"
                disabled={!ok}
                aria-pressed={on}
                aria-label={d ? describe(d) : fmtDate(date)}
                onClick={() => {
                  onPick(date)
                  setOpen(false)
                }}
                className={cn(
                  'relative h-9 rounded-full text-[13px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  on ? 'bg-indigo-900 text-white' : ok ? 'cursor-pointer text-ink-900 hover-outline' : 'cursor-default text-[#c4bac2]',
                  d?.open ? 'font-semibold' : 'font-normal',
                )}
              >
                {k + 1}
                <span aria-hidden className={cn('absolute bottom-1 left-1/2 -ml-0.5 size-1 rounded-full', !on && d?.open ? 'bg-rose-400' : 'bg-transparent')} />
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1.5 px-1 pt-2.5 text-[11.5px] text-ink-500">
          <span aria-hidden className="size-[5px] rounded-full bg-rose-400" />
          Has open times · next 60 days
        </div>
      </PopoverContent>
    </Popover>
  )
}
