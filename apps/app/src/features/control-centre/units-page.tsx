import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { ConfirmDialog } from '@workspace/ui/components/confirm-dialog'
import { Segmented, SegmentedItem } from '@workspace/ui/components/segmented'
import { useToast } from '@workspace/ui/components/toast'
import { ToneDot } from '@workspace/ui/components/tone-dot'
import { cn } from '@workspace/ui/lib/utils'
import { BRAND } from '@/lib/brand'
import { PersonAvatar } from '@/features/directory/people-bits'
import { isOnBooks, liveUnits, unitById, unitKids, unitLead, unitMembers, unitPath, unitTone } from '@/features/org/logic'
import { usePeople, useSites, useUnitActions, useUnits } from '@/features/org/queries'
import type { Unit } from '@/features/org/types'
import { ControlTitle, Panel, RoleBadge, RuleStrip, useCanEdit } from './control-bits'
import { UnitDialog } from './unit-dialog'
import type { UnitDraft } from './unit-dialog'

/**
 * The org tree as Control Centre keeps it. Tree mode: the units at the left, the selected one at
 * the right with its people. Chart mode: the divisions in a row with their sub-units. `?id=`
 * selects a unit so the overview, the Directory and the rail can link straight to one.
 */
export function UnitsPage() {
  const units = useUnits(), people = usePeople(), sites = useSites()
  const actions = useUnitActions()
  const canEdit = useCanEdit()
  const toast = useToast()
  const navigate = useNavigate()
  const search = useSearch({ from: '/_app/$app/$section' })
  const [mode, setMode] = useState<'tree' | 'chart'>('tree')
  const [open, setOpen] = useState<Record<string, boolean>>({ ops: true, people: true })
  const [draft, setDraft] = useState<UnitDraft | null>(null)
  const [archiving, setArchiving] = useState<Unit | null>(null)
  const roots = unitKids(units, null)
  const sel = unitById(units, search.id) ?? roots[0]
  const select = (id: string) => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'units' }, search: { id }, replace: true })
  const active = people.filter((p) => isOnBooks(p) && p.status === 'Active')
  const empty = liveUnits(units).filter((u) => !unitMembers(people, units, u.id, true).length)
  const lead = unitLead(units, people, sel.id)
  const direct = unitMembers(people, units, sel.id, false)
  const kids = unitKids(units, sel.id)

  const rows = useMemo(() => {
    const out: { u: Unit; depth: number; kids: number }[] = []
    const walk = (parent: string | null, depth: number) => unitKids(units, parent).forEach((u) => { const k = unitKids(units, u.id).length; out.push({ u, depth, kids: k }); if (open[u.id]) walk(u.id, depth + 1) })
    walk(null, 0)
    return out
  }, [units, open])

  function askArchive(u: Unit) {
    if (!canEdit) return toast('Read only as Staff — ask an Admin to change setup', { ok: false })
    const k = unitKids(units, u.id).length, n = unitMembers(people, units, u.id, false).length
    if (k) return toast(`Move or archive its ${k} ${k === 1 ? 'sub-unit' : 'sub-units'} first`, { ok: false })
    if (n) return toast(`${n} ${n === 1 ? 'employee sits' : 'employees sit'} here — reassign them first`, { ok: false })
    setArchiving(u)
  }
  function guard(fn: () => void) {
    return () => (canEdit ? fn() : toast('Read only as Staff — ask an Admin to change setup', { ok: false }))
  }

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          overline="Organisation"
          title="Admin units"
          description="One org tree — divisions, departments and teams. The Directory shows this same structure read-only; approvals and notifications follow its shape."
          actions={
            <>
              <Segmented>
                <SegmentedItem active={mode === 'tree'} onClick={() => setMode('tree')}>
                  Tree
                </SegmentedItem>
                <SegmentedItem active={mode === 'chart'} onClick={() => setMode('chart')}>
                  Org chart
                </SegmentedItem>
              </Segmented>
              <Button onClick={guard(() => setDraft({ parent: sel.id }))}>
                New unit
                <ButtonArrow>
                  <Plus strokeWidth={2.2} />
                </ButtonArrow>
              </Button>
            </>
          }
        />
        <RuleStrip>
          {liveUnits(units).length} units · {active.length} people placed · {empty.length ? `${empty.length} ${empty.length === 1 ? 'unit' : 'units'} with nobody in ${empty.length === 1 ? 'it' : 'them'}` : 'every unit has someone in it'}
        </RuleStrip>

        {mode === 'chart' ? (
          <Card className="gap-0 overflow-x-auto px-6 py-7">
            <div className="flex min-w-min flex-col items-center">
              <button type="button" onClick={() => setMode('tree')} className="rounded-[13px] bg-tone-warning-soft px-5 py-3 text-center shadow-[inset_0_0_0_1px_var(--tone-warning)] outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="text-ui font-bold text-foreground">{BRAND.name}</div>
                <div className="mt-0.5 text-caption text-faint">
                  {active.length} people · {roots.length} top-level
                </div>
              </button>
              <div className="relative mt-[30px] flex items-start gap-[18px] pt-[30px]">
                <span aria-hidden="true" className="absolute top-[-30px] left-1/2 h-[30px] w-px bg-border" />
                <span aria-hidden="true" className="absolute top-0 h-px bg-border" style={{ left: `calc((100% - ${(roots.length - 1) * 18}px) / ${roots.length * 2})`, right: `calc((100% - ${(roots.length - 1) * 18}px) / ${roots.length * 2})` }} />
                {roots.map((u) => {
                  const k = unitKids(units, u.id), l = unitLead(units, people, u.id)
                  return (
                    <div key={u.id} className="relative flex min-w-[168px] flex-1 flex-col">
                      <span aria-hidden="true" className="absolute top-[-30px] left-1/2 h-[30px] w-px bg-border" />
                      <button type="button" onClick={() => { select(u.id); setOpen((o) => ({ ...o, [u.id]: true })) }} className={cn('rounded-xl px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring', sel.id === u.id ? 'bg-surface-band shadow-[inset_0_0_0_1.5px_var(--sage)]' : 'bg-surface-soft shadow-[inset_0_0_0_1px_var(--divider)] hover:bg-surface-band')}>
                        <div className="flex items-center gap-[7px]">
                          <ToneDot tone={unitTone(units, u.id)} shape="square" size={7} />
                          <span className="min-w-0 flex-1 truncate text-ui-sm font-bold text-foreground">{u.name}</span>
                          <span className="text-caption font-bold text-faint">{unitMembers(people, units, u.id, true).length}</span>
                        </div>
                        <div className="mt-1 text-caption text-faint">{l ? l.name : 'No lead yet'}</div>
                      </button>
                      {k.length > 0 && (
                        <div className="mt-2.5 ml-3.5 flex flex-col gap-[5px] border-l border-divider pl-3.5">
                          {k.map((c) => (
                            <button key={c.id} type="button" onClick={() => { select(c.id); setMode('tree') }} className={cn('flex items-center gap-2 rounded-[9px] px-[11px] py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring', sel.id === c.id ? 'bg-surface-band' : 'shadow-[inset_0_0_0_1px_var(--divider)] hover:bg-surface-soft')}>
                              <span className="min-w-0 flex-1 truncate text-compact font-bold text-body">{c.name}</span>
                              <span className="text-caption text-faint">{unitMembers(people, units, c.id, true).length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mt-3 text-caption text-faint">Units only — the Directory draws the same shape with every person in it. Click a unit to open it.</div>
          </Card>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,288px)_minmax(0,1fr)]">
            <Card className="gap-0 px-2.5 py-3">
              <ul className="flex flex-col gap-px">
                {rows.map(({ u, depth, kids: k }) => (
                  <li key={u.id}>
                    <div className={cn('flex items-center gap-[7px] rounded-[9px] py-[7px] pr-2.5 text-ui-sm outline-none', sel.id === u.id ? 'bg-sidebar-accent font-bold text-foreground' : 'text-body hover:bg-surface-soft', depth === 0 && 'font-bold')} style={{ paddingLeft: 10 + depth * 15 }}>
                      <button type="button" aria-label={open[u.id] ? 'Collapse' : 'Expand'} onClick={() => setOpen((o) => ({ ...o, [u.id]: !o[u.id] }))} className={cn('grid size-[15px] shrink-0 place-items-center text-faint transition-transform duration-instant', open[u.id] && 'rotate-90', !k && 'invisible')}>
                        <ChevronRight className="size-[11px]" strokeWidth={1.9} />
                      </button>
                      <button type="button" onClick={() => select(u.id)} className="min-w-0 flex-1 truncate text-left outline-none">
                        {u.name}
                      </button>
                      <span className="text-caption tabular-nums text-faint">{unitMembers(people, units, u.id, true).length}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="flex min-w-0 flex-col gap-4">
              <Panel bodyClassName="pt-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-caption text-faint">{sel.parent ? unitPath(units, sel.parent) : 'Top level'}</div>
                    <h2 className="mt-1 text-[22px] leading-tight font-bold tracking-[-0.015em] text-foreground">{sel.name}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2.5">
                      <Badge variant="neutral" size="sm">
                        {sel.kind}
                      </Badge>
                      <span className="text-compact text-faint">
                        {sel.code} · {lead ? `led by ${lead.name}` : 'no lead yet'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-[7px]">
                    <Button variant="outline" size="sm" onClick={guard(() => setDraft({ parent: sel.id }))}>
                      Add sub-unit
                    </Button>
                    <Button variant="outline" size="sm" onClick={guard(() => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'employees' }, search: { filter: `new:${sel.id}` } }))}>
                      Add employee
                    </Button>
                    <Button variant="outline" size="sm" onClick={guard(() => setDraft({ edit: sel, parent: sel.parent }))}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-tone-risk-foreground" onClick={() => askArchive(sel)}>
                      Archive
                    </Button>
                  </div>
                </div>
                <dl className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(124px,1fr))] gap-3.5 border-t border-divider pt-4">
                  {[
                    ['In this unit', direct.length],
                    ['Including sub-units', unitMembers(people, units, sel.id, true).length],
                    ['Sub-units', kids.length],
                    ['Site managers', unitMembers(people, units, sel.id, true).filter((p) => sites.some((s) => s.ownerId === p.id)).length],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dd className="text-[19px] font-bold text-foreground">{v}</dd>
                      <dt className="mt-0.5 text-caption text-faint">{k}</dt>
                    </div>
                  ))}
                </dl>
              </Panel>

              <Card className="gap-0 overflow-clip py-0">
                <div className="flex items-baseline justify-between gap-3 border-b border-divider px-5 py-4">
                  <div className="text-overline text-faint">People in this unit</div>
                  <span className="text-caption text-faint">{kids.length ? 'Direct members only — sub-units have their own' : 'Direct members'}</span>
                </div>
                {direct.length ? (
                  <ul>
                    {direct.map((p) => (
                      <li key={p.id}>
                        <Link to="/$app/$section" params={{ app: 'control-centre', section: 'employees' }} search={{ id: p.id }} className="grid grid-cols-[32px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-divider px-5 py-3 outline-none last:border-b-0 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                          <PersonAvatar person={p} units={units} className="size-[30px]" />
                          <span className="min-w-0">
                            <span className="block truncate text-ui-sm font-bold text-foreground">{p.name}</span>
                            <span className="block truncate text-caption text-faint">{p.title}</span>
                          </span>
                          <span className="text-compact text-body">{p.primarySite ? sites.find((s) => s.id === p.primarySite)?.code : 'No site'}</span>
                          <RoleBadge role={p.role} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-5 py-[18px] text-ui-sm leading-[1.55] text-body">No one sits directly in this unit. {kids.length ? `Its sub-units hold ${unitMembers(people, units, sel.id, true).length}.` : 'Add someone, or archive the unit.'}</div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
      <UnitDialog draft={draft} onClose={() => setDraft(null)} onSaved={(id) => { select(id); setOpen((o) => ({ ...o, [units.find((u) => u.id === id)?.parent ?? '']: true })) }} />
      <ConfirmDialog
        open={archiving !== null}
        title={`Archive ${archiving?.name ?? 'unit'}?`}
        description="Archiving keeps the unit and its history — reports that already reference it stay intact. It disappears from pickers and from the Directory, and can be brought back by an Admin."
        action="Archive unit"
        danger
        onClose={() => setArchiving(null)}
        onConfirm={() => {
          if (!archiving) return
          const undo = actions.archive(archiving.id)
          toast(`${archiving.name} archived — history kept`, { undo: () => { undo(); toast(`${archiving.name} is back`) } })
          select(archiving.parent ?? roots[0].id)
          setArchiving(null)
        }}
      />
    </div>
  )
}
