import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { Switch } from '@workspace/ui/components/switch'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { monthYear, parseIsoDate, weekdayShort } from '@/lib/dates'
import { useHolidayActions, useHolidays, useRegions } from '@/features/org/queries'
import type { Holiday } from '@/features/org/types'
import { ControlTitle, RuleStrip, useCanEdit } from './control-bits'
import { HolidayDialog } from './holiday-dialog'
import type { HolidayDraft } from './holiday-dialog'

const READ_ONLY = 'Read only as Staff — ask an Admin to change setup'

/**
 * The days the organisation is closed, Maldives only for now, grouped by month so the pattern of
 * closures is visible. Hexa keeps the public holidays current: they can only be switched off.
 * Closures added here (shutdowns, stock-take days, island days) can be edited and deleted.
 */
export function HolidaysPage() {
  const holidays = useHolidays()
  const regions = useRegions().filter((r) => r.country === 'Maldives')
  const actions = useHolidayActions()
  const canEdit = useCanEdit()
  const toast = useToast()
  const [region, setRegion] = useState('all')
  // the design opens on everything, switched-off days included
  const [showOff, setShowOff] = useState(true)
  const [draft, setDraft] = useState<HolidayDraft | null>(null)
  const guard = (fn: () => void) => () => (canEdit ? fn() : toast(READ_ONLY, { ok: false }))

  const shown = holidays.filter((h) => (showOff || h.on) && (region === 'all' || !h.region || h.region === region)).sort((a, b) => a.date.localeCompare(b.date))
  const months = shown.reduce<{ key: string; label: string; rows: Holiday[] }[]>((acc, h) => {
    const key = h.date.slice(0, 7)
    let g = acc.find((x) => x.key === key)
    if (!g) acc.push((g = { key, label: monthYear(parseIsoDate(h.date)), rows: [] }))
    g.rows.push(h)
    return acc
  }, [])
  const regionName = (id: string) => regions.find((r) => r.id === id)?.name ?? 'One region'
  const regionLine = (h: Holiday) =>
    [h.region ? `${regionName(h.region)} only` : 'Everywhere you operate', h.halfDay && 'half day, closed from 1pm', h.provisional && 'date not announced yet'].filter(Boolean).join(' · ')
  const emptyText =
    region !== 'all'
      ? `No dates apply to ${regionName(region)}${showOff ? '.' : ' that are switched on.'}`
      : holidays.length
        ? 'Nothing is switched on. Show everything to turn a day back on.'
        : 'Nothing on record yet.'

  function toggle(h: Holiday) {
    if (!canEdit) return toast(READ_ONLY, { ok: false })
    actions.toggle(h.id)
    toast(`${h.name} turned ${h.on ? 'off' : 'on'}`, { undo: () => actions.toggle(h.id) })
  }
  function remove(h: Holiday) {
    const undo = actions.remove(h.id)
    toast(`${h.name} removed`, { undo: () => { undo(); toast(`${h.name} is back`) } })
  }

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          overline="System"
          title="Public holidays"
          description="Hexa keeps Maldives public holidays current. Turn off any that don't apply to you, and add your own shutdowns and stock-take days on top."
          actions={
            <Button onClick={guard(() => setDraft({}))}>
              Add your own
              <ButtonArrow>
                <Plus strokeWidth={2.2} />
              </ButtonArrow>
            </Button>
          }
        />
        <RuleStrip>
          {holidays.filter((h) => h.on).length} dates active · Hexa keeps the public ones current · {holidays.filter((h) => h.origin === 'custom').length} added by you
        </RuleStrip>

        <Card className="gap-0 overflow-clip py-0">
          <div className="flex flex-wrap items-center gap-[9px] border-b border-divider px-5 py-3.5">
            <NativeSelect value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region" className="w-[190px] [&>select]:h-8">
              <option value="all">All of Maldives</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
            <Button variant="outline" size="sm" aria-pressed={!showOff} className={cn('rounded-full font-bold', !showOff && 'bg-muted')} onClick={() => setShowOff((v) => !v)}>
              {showOff ? 'Hiding nothing' : 'Active only'}
            </Button>
            <span className="min-w-2 flex-1" />
            <span className="text-compact text-faint">
              {shown.filter((h) => h.on).length} active of {shown.length} shown · {holidays.length} on record
            </span>
          </div>

          {months.map((m, mi) => (
            <div key={m.key}>
              <div className={cn('flex items-center gap-3 border-b border-divider bg-surface-band px-5 py-[9px]', mi > 0 && 'border-t')}>
                <span className="min-w-0 flex-1 text-meta font-bold tracking-[0.06em] text-foreground uppercase">{m.label}</span>
                <span className="text-caption text-faint">
                  {m.rows.filter((h) => h.on).length} of {m.rows.length} active
                </span>
              </div>
              {m.rows.map((h) => {
                const d = parseIsoDate(h.date), sys = h.origin === 'system'
                return (
                  <div key={h.id} className={cn('flex flex-wrap items-center gap-3.5 border-b border-divider px-5 py-3 last:border-b-0', !h.on && 'opacity-50')}>
                    <span className={cn('flex h-[46px] w-11 shrink-0 flex-col items-center justify-center rounded-[10px] shadow-[inset_0_0_0_1px_var(--divider)]', h.on ? 'bg-muted' : 'bg-transparent')}>
                      <span className="text-base leading-[1.1] font-black text-foreground tabular-nums">{d.getDate()}</span>
                      <span className="text-[9.5px] font-bold tracking-[0.06em] text-faint uppercase">{weekdayShort(d)}</span>
                    </span>
                    <span className="min-w-0 flex-[1_1_170px]">
                      <span className={cn('block text-sm font-bold text-foreground', !h.on && 'line-through')}>
                        {h.name}
                        {h.nameDv && (
                          <span dir="rtl" lang="dv" className="ml-2.5 inline-block text-compact font-normal text-faint">
                            {h.nameDv}
                          </span>
                        )}
                      </span>
                      <span className="mt-[3px] block text-meta leading-[1.45] text-faint">{regionLine(h)}</span>
                    </span>
                    {sys ? (
                      <Badge variant="outline" size="sm" className="text-muted-foreground">
                        Public holiday
                      </Badge>
                    ) : (
                      <Badge variant="success" size="sm">
                        Your closure
                      </Badge>
                    )}
                    <span className="flex items-center gap-[7px]">
                      {!sys && (
                        <>
                          <Button variant="outline" size="sm" className="rounded-full font-bold" onClick={guard(() => setDraft({ edit: h }))}>
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-full font-bold text-tone-risk-foreground" onClick={guard(() => remove(h))}>
                            Delete
                          </Button>
                        </>
                      )}
                      <Switch checked={h.on} aria-label={h.name} onCheckedChange={() => toggle(h)} />
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
          {shown.length === 0 && <div className="px-5 py-[26px] text-ui-sm leading-[1.55] text-body">{emptyText}</div>}
        </Card>
      </div>
      <HolidayDialog draft={draft} onClose={() => setDraft(null)} />
    </div>
  )
}
