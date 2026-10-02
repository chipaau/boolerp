import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { MiniCalendar } from '@workspace/ui/components/mini-calendar'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { addMonths, dayOfMonth, firstOfMonth, fmtRange, fmtTime, fromMinutes, meetingsOn, monthShort, shortDate, toMinutes } from './logic'
import { useMeetingActions, useMeetings } from './queries'
import type { Meeting } from './types'

const TIMES = ['09:00', '09:30', '10:00', '11:00', '13:00', '14:00', '15:00', '16:30']

/** Pick a day and a start; the meeting keeps its length. Moving is undoable from the toast. */
export function RescheduleDialog({ meeting, today, onClose }: { meeting: Meeting | null; today: string; onClose: () => void }) {
  const meetings = useMeetings()
  const actions = useMeetingActions()
  const toast = useToast()
  const [date, setDate] = useState(today)
  const [start, setStart] = useState('09:00')
  const [month, setMonth] = useState(today)

  useEffect(() => {
    if (!meeting) return
    setDate(meeting.date)
    setStart(meeting.start)
    setMonth(firstOfMonth(meeting.date))
  }, [meeting])

  if (!meeting) return null
  const len = toMinutes(meeting.end) - toMinutes(meeting.start)
  const marks = Object.fromEntries([...new Set(meetings.map((m) => m.date))].map((d) => [d, meetingsOn(meetings, d).length]))

  function confirm() {
    if (!meeting) return
    const end = fromMinutes(toMinutes(start) + len)
    const undo = actions.move(meeting.id, date, start, end)
    onClose()
    toast(`Moved to ${dayOfMonth(date)} ${monthShort(date)}, ${fmtTime(start)}`, { undo: () => { undo(); toast('Move undone') } })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[420px]" showCloseButton={false}>
        <DialogHeader className="flex-row items-center justify-between gap-3.5 border-b border-divider px-6 pt-[22px] pb-4 text-left">
          <div>
            <DialogTitle className="text-[19px] tracking-[-0.015em]">Reschedule</DialogTitle>
            <DialogDescription className="mt-1 text-compact text-muted-foreground">
              {meeting.title} · {shortDate(meeting.date)} · {fmtRange(meeting.start, meeting.end)}
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </DialogHeader>
        <div className="px-6 pt-5 pb-1">
          <MiniCalendar compact month={month} selected={date} today={today} marks={marks} onSelect={setDate} onMonthChange={(d) => setMonth(addMonths(month, d))} />
          <div className="mt-[18px] mb-2 text-micro font-bold tracking-[0.11em] text-faint uppercase">Start time</div>
          <div className="flex flex-wrap gap-[7px]">
            {TIMES.map((t) => (
              <button key={t} type="button" onClick={() => setStart(t)} className={cn('h-8 rounded-full px-[13px] text-meta font-bold outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring', start === t ? 'bg-primary text-foreground' : 'bg-muted text-body hover:bg-secondary-hover')}>
                {fmtTime(t)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-divider px-6 pt-4 pb-[18px]">
          <span className="text-meta text-muted-foreground">
            Moving to {dayOfMonth(date)} {monthShort(date)} at {fmtTime(start)}
          </span>
          <div className="flex items-center gap-[9px]">
            <Button variant="outline" onClick={onClose}>
              Keep current time
            </Button>
            <Button onClick={confirm}>Move meeting</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
