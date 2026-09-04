import { X } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { cn } from '@workspace/ui/lib/utils'
import { HexDot, TONE } from './meeting-bits'
import { SWATCHES, useCalendarActions, useCalendars, useMeetings } from './queries'

/** Rename a calendar or change its colour (admins); everyone else sees what each one covers. */
export function CalendarsDialog({ open, editable, onClose }: { open: boolean; editable: boolean; onClose: () => void }) {
  const calendars = useCalendars()
  const meetings = useMeetings()
  const actions = useCalendarActions()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[520px]" showCloseButton={false}>
        <DialogHeader className="flex-row items-start justify-between gap-3.5 border-b border-divider px-6 pt-[22px] pb-4 text-left">
          <div>
            <DialogTitle className="text-[19px] tracking-[-0.015em]">Calendars</DialogTitle>
            <DialogDescription className="mt-1 text-compact text-muted-foreground">{editable ? 'Rename a calendar or change its colour. Everyone in the workspace sees these.' : 'What each calendar covers, and who keeps it.'}</DialogDescription>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </DialogHeader>
        <div className="max-h-[min(66vh,460px)] overflow-y-auto px-6 pt-1.5 pb-1">
          {calendars.map((c, i) => {
            const n = meetings.filter((m) => m.calendar === c.key).length
            return (
              <div key={c.key} className={cn('px-0.5 py-4', i > 0 && 'border-t border-divider')}>
                <div className="flex items-center gap-3">
                  <HexDot tone={c.tone} size={11} />
                  <input
                    defaultValue={c.label}
                    readOnly={!editable}
                    onBlur={(e) => editable && actions.rename(c.key, e.target.value.trim())}
                    className={cn('h-[34px] min-w-0 flex-1 rounded-[9px] px-[11px] text-sm font-bold text-foreground outline-none', editable ? 'bg-surface-band focus-visible:ring-2 focus-visible:ring-ring' : 'bg-transparent')}
                  />
                  <span className="text-xs whitespace-nowrap text-faint">
                    {n} {n === 1 ? 'meeting' : 'meetings'}
                  </span>
                </div>
                <div className="mt-2.5 ml-[23px] flex items-center gap-[7px]">
                  {editable &&
                    SWATCHES.map((sw) => (
                      <button
                        key={sw.name}
                        type="button"
                        title={sw.name}
                        aria-label={sw.name}
                        onClick={() => actions.recolor(c.key, sw.tone)}
                        className={cn('size-[17px] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring', TONE[sw.tone].dot, sw.tone === c.tone && 'ring-2 ring-card ring-offset-[3px] ring-offset-current')}
                        style={sw.tone === c.tone ? { boxShadow: '0 0 0 2px var(--card), 0 0 0 3.5px currentColor' } : undefined}
                      />
                    ))}
                  <span className="ms-auto text-fine text-faint">{c.visibility}</span>
                </div>
              </div>
            )
          })}
          {!editable && <div className="px-0.5 pt-3.5 pb-1.5 text-xs leading-[1.55] text-faint">Shared calendars are named and coloured by Admins. You can still hide any of them from your own view.</div>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-divider px-6 pt-[15px] pb-[18px]">
          <span className="text-meta text-muted-foreground">
            {calendars.length} calendars · {meetings.length} meetings visible to you
          </span>
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
