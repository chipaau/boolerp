import { useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ChevronRight, Plus } from 'lucide-react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { ConfirmDialog } from '@workspace/ui/components/confirm-dialog'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { useToast } from '@workspace/ui/components/toast'
import { ToneDot } from '@workspace/ui/components/tone-dot'
import { cn } from '@workspace/ui/lib/utils'
import { BRAND } from '@/lib/brand'
import { PersonAvatar, TONE_FALLBACK } from '@/features/directory/people-bits'
import { isOnBooks, liveUnits, unitById, unitChain, unitKids, unitLead, unitMembers, unitPath, unitTone } from '@/features/org/logic'
import { usePeople, useUnitActions, useUnits } from '@/features/org/queries'
import type { Tone, Unit } from '@/features/org/types'
import { ControlTitle, FieldLabel, RuleStrip, useCanEdit } from './control-bits'
import { UnitDialog } from './unit-dialog'
import type { UnitDraft } from './unit-dialog'

const SWATCHES: { name: string; tone: Tone }[] = [
  { name: 'Sage', tone: 'success' },
  { name: 'Plum', tone: 'plum' },
  { name: 'Slate', tone: 'slate' },
  { name: 'Tan', tone: 'tan' },
  { name: 'Amber', tone: 'warning' },
  { name: 'Clay', tone: 'risk' },
  { name: 'Rose', tone: 'rose' },
]
const TONE_TEXT: Record<Tone, string> = {
  success: 'text-tone-success-foreground', plum: 'text-tone-plum-foreground', slate: 'text-tone-slate-foreground', tan: 'text-tone-tan-foreground',
  warning: 'text-tone-warning-foreground', risk: 'text-tone-risk-foreground', danger: 'text-tone-danger-foreground', neutral: 'text-tone-neutral-foreground', rose: 'text-tone-rose-foreground',
}

/**
 * The org tree as drill-down columns (the Directory design's structure view): top level, then
 * each level you open. Beneath, the selected group: rename, colour, lead, nest a new group,
 * reorder among its siblings, archive what is empty, and the people sitting directly in it.
 * `?id=` selects a group; `?id=company` the company itself.
 */
export function UnitsPage() {
  const units = useUnits(), people = usePeople()
  const actions = useUnitActions()
  const canEdit = useCanEdit()
  const toast = useToast()
  const navigate = useNavigate()
  const search = useSearch({ from: '/_app/$app/$section' })
  const [draft, setDraft] = useState<UnitDraft | null>(null)
  const [archiving, setArchiving] = useState<Unit | null>(null)
  const roots = unitKids(units, null)
  const isCompany = search.id === 'company'
  const sel = isCompany ? undefined : (unitById(units, search.id) ?? roots[0])
  const path = sel ? unitChain(units, sel.id) : []
  const select = (id: string) => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'units' }, search: { id }, replace: true })
  const guard = (fn: () => void) => () => (canEdit ? fn() : toast('Read only as Staff — ask an Admin to change setup', { ok: false }))
  const active = people.filter((p) => isOnBooks(p) && p.status === 'Active')
  const empty = liveUnits(units).filter((u) => !unitMembers(people, units, u.id, true).length)
  const chief = people.find((p) => isOnBooks(p) && !p.managerId)

  // one column per level that is open: the top level, then each ancestor of the selection that has children
  const columns: { parent: Unit | null; items: Unit[] }[] = [{ parent: null, items: roots }]
  path.forEach((u) => { const kids = unitKids(units, u.id); if (kids.length) columns.push({ parent: u, items: kids }) })

  const direct = sel ? unitMembers(people, units, sel.id, false) : []
  const deep = sel ? unitMembers(people, units, sel.id, true) : []
  const lead = sel ? unitLead(units, people, sel.id) : undefined
  const tone = sel ? unitTone(units, sel.id) : 'warning'
  const sibs = sel ? unitKids(units, sel.parent) : []
  const at = sel ? sibs.findIndex((s) => s.id === sel.id) : -1

  function askArchive(u: Unit) {
    if (!canEdit) return toast('Read only as Staff — ask an Admin to change setup', { ok: false })
    if (unitMembers(people, units, u.id, true).length) return toast('Move its people out first', { ok: false })
    if (unitKids(units, u.id).length) return toast('Move or archive its subgroups first', { ok: false })
    setArchiving(u)
  }

  const row = (on: boolean, t: Tone) => cn('flex w-full items-center gap-2.5 rounded-[9px] px-3 py-[9px] text-left outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring', on ? cn(TONE_FALLBACK[t], 'shadow-[inset_2px_0_0_currentColor]') : 'hover:bg-surface-soft')

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          overline="Organisation"
          title="Admin units"
          description="One org tree, any depth — a group can hold both people and other groups. The Directory draws this same structure read-only; approvals and notifications follow its shape."
          actions={
            <Button onClick={guard(() => setDraft({ parent: sel?.id ?? null }))}>
              New group
              <ButtonArrow>
                <Plus strokeWidth={2.2} />
              </ButtonArrow>
            </Button>
          }
        />
        <RuleStrip>
          {liveUnits(units).length} groups · {active.length} people placed · {empty.length ? `${empty.length} ${empty.length === 1 ? 'group' : 'groups'} with nobody in ${empty.length === 1 ? 'it' : 'them'}` : 'every group has someone in it'}
        </RuleStrip>

        <Card className="flex max-w-full flex-row items-stretch gap-0 self-start overflow-x-auto py-0" style={{ minHeight: 322 }}>
          {columns.map((col, ci) => (
            <div key={col.parent?.id ?? 'top'} className={cn('w-[232px] shrink-0', ci < columns.length - 1 && 'border-r border-divider')}>
              <div className="flex items-center gap-2 border-b border-divider px-3.5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-compact font-bold text-foreground">{col.parent ? col.parent.name : 'Top level'}</span>
                  <span className="mt-0.5 block text-caption text-faint">
                    {col.items.length} {col.items.length === 1 ? 'group' : 'groups'}
                  </span>
                </span>
                <Button variant="outline" size="xs" onClick={guard(() => setDraft({ parent: col.parent?.id ?? null }))}>
                  + Group
                </Button>
              </div>
              <div className="flex flex-col gap-0.5 p-2">
                {ci === 0 && (
                  <button type="button" onClick={() => select('company')} className={row(isCompany, 'warning')}>
                    <ToneDot tone="warning" shape="square" size={7} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-compact font-bold text-foreground">{chief?.name ?? BRAND.name}</span>
                      <span className="block truncate text-caption text-faint">Company · top of the chart</span>
                    </span>
                    <span className="text-caption font-bold tabular-nums text-muted-foreground">{active.length}</span>
                  </button>
                )}
                {col.items.map((u) => {
                  const kids = unitKids(units, u.id), on = path.some((p) => p.id === u.id), t = unitTone(units, u.id)
                  return (
                    <button key={u.id} type="button" onClick={() => select(u.id)} className={row(on, t)}>
                      <ToneDot tone={t} shape={ci === 0 ? 'square' : 'round'} size={7} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-compact font-bold text-foreground">{u.name}</span>
                        <span className="block truncate text-caption text-faint">{kids.length ? `${kids.length} ${kids.length === 1 ? 'subgroup' : 'subgroups'}` : `${unitMembers(people, units, u.id, false).length} direct`}</span>
                      </span>
                      <span className="text-caption font-bold tabular-nums text-muted-foreground">{unitMembers(people, units, u.id, true).length}</span>
                      {kids.length > 0 && <ChevronRight className="size-3 shrink-0 text-faint" strokeWidth={1.8} />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </Card>

        <Card className="mt-4 gap-3.5 px-[22px] py-[18px]">
          {isCompany || !sel ? (
            <div>
              <div className="flex items-center gap-2">
                <ToneDot tone="warning" shape="square" size={8} />
                <span className={cn('text-overline', TONE_TEXT.warning)}>Company · {chief?.name ?? BRAND.name}</span>
              </div>
              <div className="mt-2 text-ui-sm text-muted-foreground">
                {active.length} people across {roots.length} top-level groups
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start gap-3.5">
                <div className="min-w-0 flex-1 basis-[260px]">
                  <div className="flex items-center gap-2">
                    <ToneDot tone={tone} shape={sel.parent ? 'round' : 'square'} size={8} />
                    <span className={cn('text-overline', TONE_TEXT[tone])}>{unitPath(units, sel.id)}</span>
                  </div>
                  <input
                    key={sel.id}
                    defaultValue={sel.name}
                    readOnly={!canEdit}
                    aria-label="Group name"
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== sel.name) actions.update(sel.id, { name: v }); else e.target.value = sel.name }}
                    className="mt-2 h-[38px] w-full max-w-[340px] rounded-[10px] bg-surface-band px-3 text-base font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="mt-2 text-ui-sm text-muted-foreground">
                    {deep.length} {deep.length === 1 ? 'person' : 'people'} · {direct.length} sitting here directly · {unitKids(units, sel.id).length} {unitKids(units, sel.id).length === 1 ? 'subgroup' : 'subgroups'}
                  </div>
                </div>
                <div className="shrink-0">
                  <FieldLabel>Colour</FieldLabel>
                  <div className="flex flex-wrap items-center gap-[7px]">
                    {SWATCHES.map((sw) => (
                      <button
                        key={sw.tone}
                        type="button"
                        title={sw.name}
                        aria-label={sw.name}
                        onClick={guard(() => actions.recolor(sel.id, sw.tone))}
                        className={cn('size-[22px] rounded-[7px] outline-none focus-visible:ring-2 focus-visible:ring-ring', sel.tone === sw.tone ? 'ring-2 ring-card ring-offset-2 ring-offset-current' : 'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]')}
                        style={{ backgroundColor: `var(--color-tone-${sw.tone})`, color: `var(--color-tone-${sw.tone})` }}
                      />
                    ))}
                    {sel.tone && (
                      <Button variant="link" size="xs" onClick={guard(() => actions.recolor(sel.id, undefined))}>
                        Reset
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 max-w-[210px] text-caption text-faint">{unitKids(units, sel.id).length ? 'Subgroups inherit this unless they set their own.' : 'Used for this group everywhere it appears.'}</div>
                </div>
                <div className="w-[236px] shrink-0">
                  <FieldLabel>Lead</FieldLabel>
                  <NativeSelect value={sel.leadId ?? ''} disabled={!canEdit} onChange={(e) => { const p = people.find((x) => x.id === e.target.value); actions.setLead(sel.id, e.target.value || undefined, p?.name); if (p) toast('Lead updated') }} className="[&>select]:h-[38px]">
                    <option value="">{lead ? `Standing in: ${lead.name}` : 'No lead'}</option>
                    {deep.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.title}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-divider pt-3.5">
                <Button variant="outline" size="sm" onClick={guard(() => setDraft({ parent: sel.id }))}>
                  Add subgroup
                </Button>
                <Button variant="outline" size="sm" onClick={guard(() => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'employees' }, search: { filter: `new:${sel.id}` } }))}>
                  Add person here
                </Button>
                <Button variant="link" size="sm" render={<Link to="/$app" params={{ app: 'directory' }} search={{ scope: `group:${sel.id}` }} />}>
                  View people
                </Button>
                <span aria-hidden="true" className="h-5 w-px bg-border" />
                <Button variant="outline" size="icon-sm" aria-label="Move up among its siblings" disabled={at <= 0} onClick={guard(() => actions.nudge(sel.id, -1))}>
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button variant="outline" size="icon-sm" aria-label="Move down among its siblings" disabled={at < 0 || at >= sibs.length - 1} onClick={guard(() => actions.nudge(sel.id, 1))}>
                  <ArrowDown className="size-3.5" />
                </Button>
                <span className="flex-1" />
                <span className="text-caption text-faint">{deep.length ? 'Move its people out before archiving' : 'Empty — safe to archive'}</span>
                <Button variant="outline" size="sm" className={cn(deep.length ? 'text-faint' : 'text-tone-risk-foreground')} onClick={() => askArchive(sel)}>
                  Archive
                </Button>
              </div>

              {direct.length > 0 && (
                <div>
                  <div className="mb-2 text-caption text-faint">
                    {direct.length} sitting directly in {sel.name}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {direct.map((p) => (
                      <Link key={p.id} to="/$app/$section" params={{ app: 'control-centre', section: 'employees' }} search={{ id: p.id }} className="flex items-center gap-2.5 rounded-full bg-muted py-1.5 pr-3 pl-[7px] outline-none hover:bg-secondary-hover focus-visible:ring-2 focus-visible:ring-ring">
                        <PersonAvatar person={p} units={units} className="size-[26px]" fallbackClassName="text-[9.5px]" />
                        <span className="min-w-0">
                          <span className="block truncate text-compact font-bold text-foreground">{p.name}</span>
                          <span className="block truncate text-caption text-faint">{p.title}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {direct.length === 0 && <div className="text-caption text-faint">No one sits directly in this group.</div>}
            </>
          )}
        </Card>
      </div>
      <UnitDialog draft={draft} onClose={() => setDraft(null)} onSaved={select} />
      <ConfirmDialog
        open={archiving !== null}
        title={`Archive ${archiving?.name ?? 'group'}?`}
        description="Archiving keeps the group and its history — reports that already reference it stay intact. It disappears from pickers and from the Directory, and can be brought back by an Admin."
        action="Archive group"
        danger
        onClose={() => setArchiving(null)}
        onConfirm={() => {
          if (!archiving) return
          const undo = actions.archive(archiving.id)
          toast(`${archiving.name} archived — history kept`, { undo: () => { undo(); toast(`${archiving.name} is back`) } })
          select(archiving.parent ?? 'company')
          setArchiving(null)
        }}
      />
    </div>
  )
}
