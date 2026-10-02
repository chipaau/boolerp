import { Plus, Trash2, X } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { HexDot, TONE } from './meeting-bits'
import { SWATCHES, useCalendarActions, useCalendars, useMeetings, useRoomActions, useRooms } from './queries'

export type ManageTab = 'calendars' | 'rooms'

const fieldClass = 'h-[34px] min-w-0 rounded-[9px] px-[11px] text-sm text-foreground outline-none'

/**
 * The workspace's calendars and meeting rooms. Admins rename and recolour calendars, and add,
 * edit or remove rooms; everyone else sees what each calendar covers and what each room offers.
 */
export function ManageDialog({ open, tab, editable, onClose }: { open: boolean; tab: ManageTab; editable: boolean; onClose: () => void }) {
  const calendars = useCalendars()
  const rooms = useRooms()
  const meetings = useMeetings()
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[520px]" showCloseButton={false}>
        <Tabs defaultValue={tab} className="gap-0">
          <DialogHeader className="flex-row items-start justify-between gap-3.5 px-6 pt-[22px] pb-0 text-left">
            <div>
              <DialogTitle className="text-[19px] tracking-[-0.015em]">Calendars &amp; rooms</DialogTitle>
              <DialogDescription className="mt-1 text-compact text-muted-foreground">{editable ? 'Everyone in the workspace sees these changes.' : 'What each calendar covers, and what each room offers.'}</DialogDescription>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </DialogHeader>
          <TabsList className="mt-4 px-6">
            <TabsTrigger value="calendars">Calendars</TabsTrigger>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
          </TabsList>
          <TabsContent value="calendars">
            <CalendarsPane editable={editable} />
          </TabsContent>
          <TabsContent value="rooms">
            <RoomsPane editable={editable} />
          </TabsContent>
        </Tabs>
        <div className="flex items-center justify-between gap-3 border-t border-divider px-6 pt-[15px] pb-[18px]">
          <span className="text-meta text-muted-foreground">
            {calendars.length} calendars · {rooms.length} rooms · {meetings.length} meetings visible to you
          </span>
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CalendarsPane({ editable }: { editable: boolean }) {
  const calendars = useCalendars()
  const meetings = useMeetings()
  const actions = useCalendarActions()
  return (
        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-6 pt-1.5 pb-1">
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
  )
}

function RoomsPane({ editable }: { editable: boolean }) {
  const rooms = useRooms()
  const meetings = useMeetings()
  const actions = useRoomActions()
  const toast = useToast()

  function add() {
    let n = rooms.length + 1
    while (rooms.some((r) => r.name === `Room ${n}`)) n++
    actions.add({ name: `Room ${n}`, capacity: 4, kit: 'No AV' })
  }
  function remove(name: string, bookings: number) {
    const undo = actions.remove(name)
    toast(bookings ? `${name} removed · ${bookings} bookings keep its name` : `${name} removed`, { ok: false, undo: () => { undo(); toast(`${name} is back`) } })
  }

  return (
    <div className="max-h-[min(60vh,420px)] overflow-y-auto px-6 pt-1.5 pb-1">
      {editable && (
        <div className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)_32px] gap-2 px-0.5 pt-3 pb-1 text-micro font-bold tracking-[0.08em] text-faint uppercase">
          <span>Room</span>
          <span>Seats</span>
          <span>Kit</span>
          <span />
        </div>
      )}
      {rooms.map((r, i) => {
        const n = meetings.filter((m) => m.room === r.name).length
        return editable ? (
          <div key={r.name} className={cn('grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)_32px] items-center gap-2 px-0.5 py-2.5', i > 0 && 'border-t border-divider')}>
            <input defaultValue={r.name} aria-label="Room name" onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== r.name && !rooms.some((x) => x.name === v)) actions.update(r.name, { name: v }); else e.target.value = r.name }} className={cn(fieldClass, 'bg-surface-band font-bold focus-visible:ring-2 focus-visible:ring-ring')} />
            <input defaultValue={r.capacity} type="number" min={1} max={500} aria-label="Seats" onBlur={(e) => actions.update(r.name, { capacity: Math.max(1, Number(e.target.value) || r.capacity) })} className={cn(fieldClass, 'bg-surface-band tabular-nums focus-visible:ring-2 focus-visible:ring-ring')} />
            <input defaultValue={r.kit} aria-label="Kit" placeholder="Screen · camera" onBlur={(e) => actions.update(r.name, { kit: e.target.value.trim() || 'No AV' })} className={cn(fieldClass, 'bg-surface-band focus-visible:ring-2 focus-visible:ring-ring placeholder:text-placeholder')} />
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.name}`} title={n ? `${n} bookings name this room` : 'Remove room'} onClick={() => remove(r.name, n)} className="text-faint hover:text-tone-risk-foreground">
              <Trash2 className="size-4" strokeWidth={1.6} />
            </Button>
          </div>
        ) : (
          <div key={r.name} className={cn('flex items-center gap-3 px-0.5 py-3.5', i > 0 && 'border-t border-divider')}>
            <span className="min-w-0 flex-1 text-sm font-bold text-foreground">{r.name}</span>
            <span className="text-xs text-body">
              {r.capacity} seats · {r.kit}
            </span>
            <span className="w-[84px] text-right text-xs whitespace-nowrap text-faint">
              {n} {n === 1 ? 'booking' : 'bookings'}
            </span>
          </div>
        )
      })}
      {editable ? (
        <button type="button" onClick={add} className="mt-2 mb-3 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-border py-2.5 text-compact font-bold text-body outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
          <Plus className="size-3.5" strokeWidth={2} /> Add room
        </button>
      ) : (
        <div className="px-0.5 pt-3.5 pb-1.5 text-xs leading-[1.55] text-faint">Rooms and their capacity are kept by Admins. Book any of them from a meeting.</div>
      )}
    </div>
  )
}
