import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { Switch } from '@workspace/ui/components/switch'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { useMeetings } from '@/features/calendar/queries'
import { holidayOn } from '@/features/org/logic'
import { useHolidayActions, useHolidays, useRegions } from '@/features/org/queries'
import type { Holiday } from '@/features/org/types'
import { FieldLabel, fieldClass } from './control-bits'

export type HolidayDraft = { edit?: Holiday; date?: string }

/**
 * Add or edit your own closed day. Before saving it says what the day already holds: another
 * holiday, or meetings in Calendar that will now sit on a closed day.
 */
export function HolidayDialog({ draft, onClose }: { draft: HolidayDraft | null; onClose: () => void }) {
  const holidays = useHolidays()
  const regions = useRegions().filter((r) => r.country === 'Maldives')
  const meetings = useMeetings()
  const actions = useHolidayActions()
  const toast = useToast()
  const [editing, setEditing] = useState<Holiday | undefined>()
  const [name, setName] = useState('')
  const [nameDv, setNameDv] = useState('')
  const [date, setDate] = useState('')
  const [region, setRegion] = useState<string | null>(null)
  const [halfDay, setHalfDay] = useState(false)
  const [provisional, setProvisional] = useState(false)
  useEffect(() => {
    if (!draft) return
    const e = draft.edit
    setEditing(e)
    setName(e?.name ?? '')
    setNameDv(e?.nameDv ?? '')
    setDate(e?.date ?? draft.date ?? '')
    setRegion(e?.region ?? null)
    setHalfDay(e?.halfDay ?? false)
    setProvisional(e?.provisional ?? false)
  }, [draft])

  const clash = date ? holidayOn(holidays.filter((h) => h.id !== editing?.id), date, region) : undefined
  const booked = date ? meetings.filter((m) => m.date === date && !m.cancelled).length : 0

  function save() {
    const n = name.trim()
    if (!n || !date) return toast('A holiday needs a name and a date', { ok: false })
    const fields = { name: n, nameDv: nameDv.trim(), date, region, halfDay, provisional }
    if (editing) {
      actions.update(editing.id, fields)
      toast(`${n} updated`)
    } else {
      actions.create(fields)
      toast(`${n} added`)
    }
    onClose()
  }

  const chips = [{ id: null, label: 'Everywhere' }, ...regions.map((r) => ({ id: r.id, label: r.name }))]
  const toggleRow = (label: string, hint: string, on: boolean, set: (v: boolean) => void) => (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] bg-surface-band px-[13px] py-2.5">
      <span>
        <span className="block text-ui-sm font-bold text-foreground">{label}</span>
        <span className="block text-caption text-faint">{hint}</span>
      </span>
      <Switch checked={on} onCheckedChange={set} />
    </label>
  )

  return (
    <Dialog open={draft !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 px-[26px] py-6 sm:max-w-[520px]" showCloseButton={false}>
        <DialogHeader className="mb-[18px] gap-0 text-left">
          <DialogTitle className="text-xl font-black tracking-[-0.01em]">{editing ? 'Edit closure' : 'Add your own closure'}</DialogTitle>
          <DialogDescription className="mt-1.5 text-compact leading-[1.5] text-faint">Calendar blocks the day and counting schedules step over it.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
          <div>
            <FieldLabel>Name</FieldLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stock-take shutdown" className={fieldClass} autoFocus />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          </div>
        </div>
        <div className="mt-3.5">
          <FieldLabel hint=" · Dhivehi">Name</FieldLabel>
          <input value={nameDv} onChange={(e) => setNameDv(e.target.value)} dir="rtl" lang="dv" className={fieldClass} />
        </div>
        <div className="mt-4">
          <FieldLabel>Applies to</FieldLabel>
          <div role="radiogroup" aria-label="Applies to" className="flex flex-wrap gap-1.5">
            {chips.map((c) => {
              const on = region === c.id
              return (
                <Button
                  key={c.id ?? 'all'}
                  role="radio"
                  aria-checked={on}
                  variant="outline"
                  size="sm"
                  className={cn('rounded-full font-bold', on ? 'bg-sage text-sage-foreground shadow-none hover:bg-sage' : 'text-body')}
                  onClick={() => setRegion(c.id)}
                >
                  {c.label}
                </Button>
              )
            })}
          </div>
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {toggleRow('Half day', 'Closed from 1pm', halfDay, setHalfDay)}
          {toggleRow('Provisional', 'Date not announced yet', provisional, setProvisional)}
        </div>
        {(clash || booked > 0) && (
          <Alert variant="warning" className="mt-4">
            <AlertDescription className="leading-[1.5]">
              {clash && <div>{clash.name} is already on this day.</div>}
              {booked > 0 && <div>{booked} {booked === 1 ? 'meeting is' : 'meetings are'} booked that day — organisers will see it lands on a holiday.</div>}
            </AlertDescription>
          </Alert>
        )}
        <div className="mt-[22px] flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{editing ? 'Save closure' : 'Add closure'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
