import { useEffect, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { DatePicker } from '@workspace/ui/components/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { SearchField } from '@workspace/ui/components/search-field'
import { Switch } from '@workspace/ui/components/switch'
import { useToast } from '@workspace/ui/components/toast'
import { useMeetings } from '@/features/calendar/queries'
import { holidayForEveryone, unitPath } from '@/features/org/logic'
import { useHolidayActions, useHolidays, useSites, useUnits } from '@/features/org/queries'
import type { Holiday } from '@/features/org/types'
import { FieldLabel, fieldClass } from './control-bits'

export type HolidayDraft = { edit?: Holiday; date?: string }
type AppliesTo = Holiday['appliesTo']

/**
 * Add or edit your own holiday. Before saving it says what the day already holds: another
 * holiday for the same people, or meetings in Calendar that will now sit on a closed day.
 */
export function HolidayDialog({ draft, onClose }: { draft: HolidayDraft | null; onClose: () => void }) {
  const holidays = useHolidays()
  const meetings = useMeetings()
  const actions = useHolidayActions()
  const toast = useToast()
  const [editing, setEditing] = useState<Holiday | undefined>()
  const [name, setName] = useState('')
  const [nameDv, setNameDv] = useState('')
  const [date, setDate] = useState('')
  const [appliesTo, setAppliesTo] = useState<AppliesTo>({ units: [], sites: [] })
  const [halfDay, setHalfDay] = useState(false)
  useEffect(() => {
    if (!draft) return
    const e = draft.edit
    setEditing(e)
    setName(e?.name ?? '')
    setNameDv(e?.nameDv ?? '')
    setDate(e?.date ?? draft.date ?? '')
    setAppliesTo(e?.appliesTo ?? { units: [], sites: [] })
    setHalfDay(e?.halfDay ?? false)
  }, [draft])

  const everyone = !appliesTo.units.length && !appliesTo.sites.length
  const clash = date
    ? holidays.find(
        (h) =>
          h.id !== editing?.id &&
          h.on &&
          h.date === date &&
          (everyone || holidayForEveryone(h) || h.appliesTo.units.some((u) => appliesTo.units.includes(u)) || h.appliesTo.sites.some((s) => appliesTo.sites.includes(s)))
      )
    : undefined
  const booked = date ? meetings.filter((m) => m.date === date && !m.cancelled).length : 0

  function save() {
    const n = name.trim()
    if (!n || !date) return toast('A holiday needs a name and a date', { ok: false })
    const fields = { name: n, nameDv: nameDv.trim(), date, appliesTo, halfDay }
    if (editing) {
      actions.update(editing.id, fields)
      toast(`${n} updated`)
    } else {
      actions.create(fields)
      toast(`${n} added`)
    }
    onClose()
  }

  return (
    <Dialog open={draft !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 px-[26px] py-6 sm:max-w-[520px]" showCloseButton={false}>
        <DialogHeader className="mb-[18px] gap-0 text-left">
          <DialogTitle className="text-xl font-black tracking-[-0.01em]">{editing ? 'Edit holiday' : 'Add a holiday'}</DialogTitle>
          <DialogDescription className="mt-1.5 text-compact leading-[1.5] text-faint">Calendar blocks the day and counting schedules step over it.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
          <div>
            <FieldLabel>Name</FieldLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stock-take shutdown" className={fieldClass} autoFocus />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <DatePicker value={date} onChange={setDate} aria-label="Date" />
          </div>
        </div>
        <div className="mt-3.5">
          <FieldLabel hint=" · Dhivehi">Name</FieldLabel>
          <input value={nameDv} onChange={(e) => setNameDv(e.target.value)} dir="rtl" lang="dv" className={fieldClass} />
        </div>
        <div className="mt-4">
          <FieldLabel>Applies to</FieldLabel>
          <AppliesToPicker value={appliesTo} onChange={setAppliesTo} />
        </div>
        <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-[10px] bg-surface-band px-[13px] py-2.5">
          <span>
            <span className="block text-ui-sm font-bold text-foreground">Half day</span>
          </span>
          <Switch checked={halfDay} onCheckedChange={setHalfDay} />
        </label>
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
          <Button onClick={save}>{editing ? 'Save holiday' : 'Add holiday'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Who a holiday covers: everyone when nothing is picked, else chosen admin units (each covering its
 * sub-units) and/or sites. A searchable checklist in a popover; picks show as removable chips.
 */
export function AppliesToPicker({ value, onChange }: { value: AppliesTo; onChange: (v: AppliesTo) => void }) {
  const units = useUnits()
  const sites = useSites()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const unitRows = units.map((u) => ({ id: u.id, label: unitPath(units, u.id) })).filter((r) => r.label.toLowerCase().includes(needle)).sort((a, b) => a.label.localeCompare(b.label))
  const siteRows = sites.filter((s) => s.name.toLowerCase().includes(needle)).map((s) => ({ id: s.id, label: s.name }))
  const flip = (kind: keyof AppliesTo, id: string) =>
    onChange({ ...value, [kind]: value[kind].includes(id) ? value[kind].filter((x) => x !== id) : [...value[kind], id] })
  const picked = [
    ...value.units.map((id) => ({ kind: 'units' as const, id, label: unitPath(units, id) })),
    ...value.sites.map((id) => ({ kind: 'sites' as const, id, label: sites.find((s) => s.id === id)?.name ?? id })),
  ]
  const group = (title: string, kind: keyof AppliesTo, rows: { id: string; label: string }[]) =>
    rows.length > 0 && (
      <div className="py-1">
        <div className="px-2 pt-1 pb-1.5 text-caption font-bold tracking-[0.06em] text-faint uppercase">{title}</div>
        {rows.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-ui-sm text-foreground hover:bg-muted">
            <Checkbox checked={value[kind].includes(r.id)} onCheckedChange={() => flip(kind, r.id)} />
            <span className="min-w-0 truncate">{r.label}</span>
          </label>
        ))}
      </div>
    )

  return (
    <div>
      <Popover onOpenChange={(o) => !o && setQ('')}>
        <PopoverTrigger className="flex h-10 w-full items-center justify-between gap-2 rounded-[10px] bg-surface-band pr-3 pl-[13px] text-left text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="truncate">{picked.length ? `${picked.length} selected` : 'Everyone'}</span>
          <ChevronDown className="size-[15px] shrink-0 text-faint" strokeWidth={1.6} />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--anchor-width)] min-w-[280px] p-2">
          <SearchField size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a unit or site" aria-label="Find a unit or site" />
          <div className="mt-1.5 max-h-[260px] overflow-y-auto">
            {group('Admin units', 'units', unitRows)}
            {group('Sites', 'sites', siteRows)}
            {!unitRows.length && !siteRows.length && <div className="px-2 py-3 text-ui-sm text-faint">Nothing matches.</div>}
          </div>
          {picked.length > 0 && (
            <div className="mt-1 border-t border-divider pt-1.5">
              <Button variant="ghost" size="sm" onClick={() => onChange({ units: [], sites: [] })}>
                Back to everyone
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {picked.length === 0 ? (
          <span className="text-caption text-faint">Everyone. Pick units or sites to narrow it — a unit covers its sub-units.</span>
        ) : (
          picked.map((p) => (
            <span key={`${p.kind}-${p.id}`} className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-2.5 text-caption font-bold text-foreground">
              <span className="min-w-0 truncate">{p.label}</span>
              <button type="button" aria-label={`Remove ${p.label}`} className="grid size-4 place-items-center rounded-full text-faint hover:bg-surface-band hover:text-foreground" onClick={() => flip(p.kind, p.id)}>
                <X className="size-3" strokeWidth={2.2} />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  )
}
