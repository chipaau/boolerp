import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { DropdownMenuItem } from '@workspace/ui/components/dropdown-menu'
import { ConfirmDialog } from '@workspace/ui/components/confirm-dialog'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { useToast } from '@workspace/ui/components/toast'
import { ToneDot } from '@workspace/ui/components/tone-dot'
import { cn } from '@workspace/ui/lib/utils'
import { BRAND } from '@/lib/brand'
import { OrgCanvas, OrgChartToolbar, buildOrgTree, useOrgChart } from '@/features/directory/org-chart'
import type { OrgNode } from '@/features/directory/org-chart'
import { PersonAvatar } from '@/features/directory/people-bits'
import { isOnBooks, liveUnits, unitById, unitKids, unitLead, unitMembers, unitPath, unitTone } from '@/features/org/logic'
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
 * The same org chart the Directory draws, but editable: click a group (or the company) to select
 * it, or use a card's menu to nest, staff or archive it. Beneath, the selected group: rename,
 * colour, lead, reorder among its siblings, and the people sitting directly in it.
 * `?id=<unit>` selects a group; no id (or `?id=company`) the company itself.
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
  const sel = search.id && search.id !== 'company' ? unitById(units, search.id) : undefined
  const select = (id: string) => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'units' }, search: { id }, replace: true })
  const guard = (fn: () => void) => () => (canEdit ? fn() : toast('Read only as Staff — ask an Admin to change setup', { ok: false }))
  const active = people.filter((p) => isOnBooks(p) && p.status === 'Active')
  const empty = liveUnits(units).filter((u) => !unitMembers(people, units, u.id, true).length)
  const chief = people.find((p) => isOnBooks(p) && !p.managerId)

  const today = useMemo(() => new Date(), [])
  const tree = useMemo(() => buildOrgTree(units, people, today), [units, people, today])
  const selNode = sel ? `g:${sel.id}` : 'co'
  const chart = useOrgChart(tree, units, selNode)
  const hits = useMemo(() => new Set(chart.matches), [chart.matches])
  // scroll to a search hit; a deep link lands on its card once
  const [landing] = useState(search.id ? selNode : null)
  const goPerson = (id: string) => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'employees' }, search: { id } })
  const addPerson = (unitId: string) => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'employees' }, search: { filter: `new:${unitId}` } })
  const menuExtra = (n: OrgNode) => {
    if (n.kind === 'person') return <DropdownMenuItem onClick={() => n.person && goPerson(n.person.id)}>Edit employee record</DropdownMenuItem>
    const u = n.unit
    return (
      <>
        <DropdownMenuItem onClick={guard(() => setDraft({ parent: u?.id ?? null }))}>{u ? 'Add subgroup' : 'Add top-level group'}</DropdownMenuItem>
        {u && <DropdownMenuItem onClick={guard(() => addPerson(u.id))}>Add person here</DropdownMenuItem>}
        {u && <DropdownMenuItem onClick={() => select(u.id)}>Edit group</DropdownMenuItem>}
        {u && <DropdownMenuItem variant="destructive" onClick={() => askArchive(u)}>Archive</DropdownMenuItem>}
      </>
    )
  }

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

        <Card className="gap-0 overflow-clip py-0">
          <OrgChartToolbar tree={tree} chart={chart} summary={sel ? `Editing ${sel.name}` : 'Click a group to edit it'} />
          <OrgCanvas
            tree={tree}
            units={units}
            openSet={chart.openSet}
            setOpen={chart.setOpenSet}
            zoom={chart.zoom}
            hits={hits}
            focus={chart.current ?? landing}
            selected={selNode}
            onSelect={(n) => select(n.unit ? n.unit.id : 'company')}
            onOpenPerson={goPerson}
            onSeePeople={(uid) => void navigate({ to: '/$app', params: { app: 'directory' }, search: { scope: `group:${uid}` } })}
            menuExtra={menuExtra}
            className="h-[min(56vh,560px)]"
          />
        </Card>

        <Card className="mt-4 gap-3.5 px-[22px] py-[18px]">
          {!sel ? (
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
                <Button variant="outline" size="sm" onClick={guard(() => addPerson(sel.id))}>
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
