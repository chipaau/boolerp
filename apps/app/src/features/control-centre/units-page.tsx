import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ChevronRight, Plus } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { DropdownMenuItem } from '@workspace/ui/components/dropdown-menu'
import { ConfirmDialog } from '@workspace/ui/components/confirm-dialog'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { useToast } from '@workspace/ui/components/toast'
import { ToneDot } from '@workspace/ui/components/tone-dot'
import { LinkTab, LinkTabs } from '@workspace/ui/components/tabs'
import { cn } from '@workspace/ui/lib/utils'
import { BRAND } from '@/lib/brand'
import { OrgCanvas, OrgChartToolbar, buildOrgTree, useOrgChart } from '@/features/directory/org-chart'
import type { OrgNode } from '@/features/directory/org-chart'
import { PersonAvatar } from '@/features/directory/people-bits'
import { isOnBooks, liveUnits, siteById, unitById, unitChain, unitDescendants, unitKids, unitLead, unitMembers, unitPath } from '@/features/org/logic'
import { useAuditLog, usePeople, useSites, useUnitActions, useUnits } from '@/features/org/queries'
import type { Person, Site, Tone, Unit } from '@/features/org/types'
import { ControlTitle, FieldLabel, RoleBadge, RuleStrip, useCanEdit } from './control-bits'
import { UnitDialog } from './unit-dialog'
import type { UnitDraft } from './unit-dialog'

const TONE_TEXT: Record<Tone, string> = {
  success: 'text-tone-success-foreground', plum: 'text-tone-plum-foreground', slate: 'text-tone-slate-foreground', tan: 'text-tone-tan-foreground',
  warning: 'text-tone-warning-foreground', risk: 'text-tone-risk-foreground', danger: 'text-tone-danger-foreground', neutral: 'text-tone-neutral-foreground', rose: 'text-tone-rose-foreground',
}
const READ_ONLY = 'Read only as Staff — ask an Admin to change setup'
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
type Mode = 'tree' | 'chart'

/**
 * The org tree, two ways. Tree (default): an indented, collapsible list beside the selected unit's
 * detail and the people sitting in it. Org chart: the Directory's chart, editable — select, use a
 * card's menu, or drag a unit onto another to move it — with the selected unit beneath.
 * `?id=<unit>` selects a unit; no id (or `?id=company`) the company itself. The mode is component
 * state: the section route's search schema only carries id/date/filter/q.
 */
export function UnitsPage() {
  const units = useUnits(), people = usePeople(), sites = useSites()
  const actions = useUnitActions()
  const canEdit = useCanEdit()
  const toast = useToast()
  const log = useAuditLog()
  const navigate = useNavigate()
  const search = useSearch({ from: '/_app/$app/$section' })
  const [mode, setMode] = useState<Mode>('tree')
  const [draft, setDraft] = useState<UnitDraft | null>(null)
  const [archiving, setArchiving] = useState<Unit | null>(null)
  const roots = unitKids(units, null)
  const picked = search.id && search.id !== 'company' ? unitById(units, search.id) : undefined
  // the tree always shows a unit; the chart can have the company selected
  const sel = picked ?? (mode === 'tree' ? roots[0] : undefined)
  const select = (id: string) => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'units' }, search: { id }, replace: true })
  const guard = (fn: () => void) => () => (canEdit ? fn() : toast(READ_ONLY, { ok: false }))
  const active = people.filter((p) => isOnBooks(p) && p.status === 'Active')
  const empty = liveUnits(units).filter((u) => !unitMembers(people, units, u.id, true).length)
  const chief = people.find((p) => isOnBooks(p) && !p.managerId)

  const today = useMemo(() => new Date(), [])
  const tree = useMemo(() => buildOrgTree(units, people, today), [units, people, today])
  const selNode = picked ? `g:${picked.id}` : 'co'
  const chart = useOrgChart(tree, units, selNode)
  const hits = useMemo(() => new Set(chart.matches), [chart.matches])
  // a deep link lands on its card once
  const [landing] = useState(search.id ? selNode : null)
  const goPerson = (id: string) => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'employees' }, search: { id } })
  const addPerson = (unitId: string) => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'employees' }, search: { filter: `new:${unitId}` } })
  const menuExtra = (n: OrgNode) => {
    if (n.kind === 'person') return <DropdownMenuItem onClick={() => n.person && goPerson(n.person.id)}>Edit employee record</DropdownMenuItem>
    const u = n.unit
    return (
      <>
        <DropdownMenuItem onClick={guard(() => setDraft({ parent: u?.id ?? null }))}>{u ? 'Add sub-unit' : 'Add top-level unit'}</DropdownMenuItem>
        {u && <DropdownMenuItem onClick={guard(() => addPerson(u.id))}>Add employee here</DropdownMenuItem>}
        {u && <DropdownMenuItem onClick={guard(() => setDraft({ edit: u, parent: u.parent }))}>Edit unit</DropdownMenuItem>}
        {u && <DropdownMenuItem variant="destructive" onClick={() => askArchive(u)}>Archive</DropdownMenuItem>}
      </>
    )
  }

  function exportCsv() {
    const rows = [['Code', 'Name', 'Type', 'Parent'], ...liveUnits(units).map((u) => [u.code, u.name, u.kind, u.parent ? unitPath(units, u.parent) : ''])]
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const name = 'hexa-admin-units.csv'
    try {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } catch {
      // a blocked download still logs the intent
    }
    log('Export', `${name} downloaded`)
    toast(`${name} downloaded`)
  }

  function askArchive(u: Unit) {
    if (!canEdit) return toast(READ_ONLY, { ok: false })
    const kids = unitKids(units, u.id).length
    const here = unitMembers(people, units, u.id, true).length
    if (kids) return toast(`Move or archive its ${plural(kids, 'sub-unit', 'sub-units')} first`, { ok: false })
    if (here) return toast(`${here} ${here === 1 ? 'employee sits' : 'employees sit'} here — reassign them first`, { ok: false })
    setArchiving(u)
  }

  const detail = sel ? (
    <UnitDetail
      unit={sel}
      units={units}
      people={people}
      sites={sites}
      canEdit={canEdit}
      onAddSub={guard(() => setDraft({ parent: sel.id }))}
      onAddPerson={guard(() => addPerson(sel.id))}
      onEdit={guard(() => setDraft({ edit: sel, parent: sel.parent }))}
      onArchive={() => askArchive(sel)}
      onLead={(id) => {
        const p = people.find((x) => x.id === id)
        actions.setLead(sel.id, id || undefined, p?.name)
        if (p) toast('Lead updated')
      }}
      onNudge={(d) => (canEdit ? actions.nudge(sel.id, d) : toast(READ_ONLY, { ok: false }))}
      onOpenPerson={goPerson}
    />
  ) : null

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          overline="Organisation"
          title="Admin units"
          description="One org tree — divisions, departments and teams. The Directory shows this same structure read-only; approvals and notifications follow its shape."
          actions={
            <>
              <Button variant="outline" onClick={exportCsv}>
                Export CSV
              </Button>
              <Button onClick={guard(() => setDraft({ parent: sel?.id ?? null }))}>
                New unit
                <ButtonArrow>
                  <Plus strokeWidth={2.2} />
                </ButtonArrow>
              </Button>
            </>
          }
        />
        <LinkTabs aria-label="View" className="mb-4">
          {(['tree', 'chart'] as const).map((m) => (
            <LinkTab key={m} active={mode === m} onClick={() => setMode(m)}>
              {m === 'tree' ? 'Tree' : 'Org chart'}
            </LinkTab>
          ))}
        </LinkTabs>
        <RuleStrip>
          {plural(liveUnits(units).length, 'unit', 'units')} · {active.length} people placed · {empty.length ? `${plural(empty.length, 'unit', 'units')} with nobody in ${empty.length === 1 ? 'it' : 'them'}` : 'every unit has someone in it'}
        </RuleStrip>

        {mode === 'tree' ? (
          <div className="grid items-start gap-4 md:grid-cols-[minmax(0,288px)_minmax(0,1fr)]">
            <UnitTree units={units} people={people} selected={sel?.id} onSelect={select} />
            <div className="flex min-w-0 flex-col gap-4">{detail}</div>
          </div>
        ) : (
          <>
            <Card className="gap-0 overflow-clip py-0">
              <OrgChartToolbar tree={tree} chart={chart} summary={picked ? `Editing ${picked.name} · drag a unit onto another to move it` : 'Click a unit to open it · drag one onto another to move it'} />
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
                onDropUnit={(id, target) => {
                  if (!canEdit) return (toast(READ_ONLY, { ok: false }), false)
                  const u = unitById(units, id), parent = target.unit?.id ?? null
                  if (!u || u.parent === parent) return false
                  if (parent && unitDescendants(units, id).some((d) => d.id === parent)) return (toast('A unit cannot move inside its own sub-unit', { ok: false }), false)
                  const undo = actions.update(id, { parent })
                  toast(`${u.name} moved under ${target.unit?.name ?? 'the company'}`, { undo: () => { undo(); toast(`${u.name} is back where it was`) } })
                  select(id)
                  return true
                }}
                className="h-[min(56vh,560px)]"
              />
            </Card>
            <div className="mt-4 flex flex-col gap-4">
              {detail ?? (
                <Card className="gap-0 px-[22px] py-5">
                  <div className="flex items-center gap-2">
                    <ToneDot tone="warning" shape="square" size={8} />
                    <span className={cn('text-overline', TONE_TEXT.warning)}>Company · {chief?.name ?? BRAND.name}</span>
                  </div>
                  <div className="mt-2 text-ui-sm text-muted-foreground">
                    {active.length} people across {plural(roots.length, 'top-level unit', 'top-level units')} · click a unit to open it
                  </div>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
      <UnitDialog draft={draft} onClose={() => setDraft(null)} onSaved={select} />
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
          select(archiving.parent ?? 'company')
          setArchiving(null)
        }}
      />
    </div>
  )
}

/** The indented, collapsible unit list: chevrons toggle, counts include sub-units. */
function UnitTree({ units, people, selected, onSelect }: { units: Unit[]; people: Person[]; selected?: string; onSelect: (id: string) => void }) {
  // top-level units start open; the selected unit's ancestors are opened whenever it changes
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(unitKids(units, null).map((u) => [u.id, true])))
  const [revealed, setRevealed] = useState<string | undefined>(undefined)
  if (selected !== revealed) {
    setRevealed(selected)
    const up = unitChain(units, selected ?? null).slice(0, -1)
    if (up.some((u) => !open[u.id])) setOpen((o) => ({ ...o, ...Object.fromEntries(up.map((u) => [u.id, true])) }))
  }
  const rows: { u: Unit; depth: number; kids: number }[] = []
  const walk = (parent: string | null, depth: number) =>
    unitKids(units, parent).forEach((u) => {
      const kids = unitKids(units, u.id).length
      rows.push({ u, depth, kids })
      if (kids && open[u.id]) walk(u.id, depth + 1)
    })
  walk(null, 0)

  return (
    <Card className="gap-0 px-2.5 py-3">
      <ul className="flex flex-col">
        {rows.map(({ u, depth, kids }) => (
          <li key={u.id}>
            <div
              role="button"
              tabIndex={0}
              aria-current={selected === u.id || undefined}
              aria-expanded={kids ? !!open[u.id] : undefined}
              onClick={() => onSelect(u.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), onSelect(u.id))
                if (kids && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) setOpen((o) => ({ ...o, [u.id]: e.key === 'ArrowRight' }))
              }}
              style={{ paddingLeft: 10 + depth * 15 }}
              className={cn(
                'flex cursor-pointer items-center gap-[7px] rounded-[9px] py-[7px] pr-2.5 text-ui-sm text-body outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring',
                depth ? 'font-medium' : 'font-bold',
                selected === u.id && 'bg-muted hover:bg-muted',
              )}
            >
              <button
                type="button"
                tabIndex={-1}
                aria-label={open[u.id] ? `Collapse ${u.name}` : `Expand ${u.name}`}
                disabled={!kids}
                onClick={(e) => (e.stopPropagation(), setOpen((o) => ({ ...o, [u.id]: !o[u.id] })))}
                className={cn('flex w-[15px] shrink-0 items-center justify-center text-faint transition-transform duration-150', !kids && 'invisible', open[u.id] && 'rotate-90')}
              >
                <ChevronRight className="size-[11px]" strokeWidth={2.2} />
              </button>
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              <span className="text-caption font-normal text-faint">{unitMembers(people, units, u.id, true).length}</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** The selected unit: header, actions, stats, lead / order, then the people sitting in it. */
function UnitDetail({
  unit, units, people, sites, canEdit, onAddSub, onAddPerson, onEdit, onArchive, onLead, onNudge, onOpenPerson,
}: {
  unit: Unit
  units: Unit[]
  people: Person[]
  sites: Site[]
  canEdit: boolean
  onAddSub: () => void
  onAddPerson: () => void
  onEdit: () => void
  onArchive: () => void
  onLead: (id: string) => void
  onNudge: (d: -1 | 1) => void
  onOpenPerson: (id: string) => void
}) {
  const direct = unitMembers(people, units, unit.id, false)
  const deep = unitMembers(people, units, unit.id, true)
  const kids = unitKids(units, unit.id)
  const lead = unitLead(units, people, unit.id)
  const sibs = unitKids(units, unit.parent)
  const at = sibs.findIndex((s) => s.id === unit.id)
  const deepIds = new Set(deep.map((p) => p.id))
  const managers = new Set(sites.filter((s) => s.ownerId && deepIds.has(s.ownerId)).map((s) => s.ownerId)).size
  const blocked = deep.length > 0 || kids.length > 0
  const stats = [
    { k: 'In this unit', v: direct.length },
    { k: 'Including sub-units', v: deep.length },
    { k: 'Sub-units', v: kids.length },
    { k: 'Site managers', v: managers },
  ]

  return (
    <>
      <Card className="gap-0 px-[22px] py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-caption text-faint">{unit.parent ? unitPath(units, unit.parent) : 'Top level'}</div>
            <h2 className="mt-[5px] text-[22px] font-black tracking-[-0.015em] text-foreground">{unit.name}</h2>
            <div className="mt-[9px] flex flex-wrap items-center gap-[9px]">
              <Badge variant="secondary" size="sm">
                {unit.kind}
              </Badge>
              <span className="text-compact text-faint">
                {unit.code} · {lead ? `led by ${lead.name}` : 'no lead yet'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-[7px]">
            <Button variant="outline" size="sm" onClick={onAddSub}>
              Add sub-unit
            </Button>
            <Button variant="outline" size="sm" onClick={onAddPerson}>
              Add employee
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button variant="outline" size="sm" className={blocked ? 'text-faint' : 'text-tone-risk-foreground'} title={blocked ? 'Move its people and sub-units out before archiving' : 'Empty — safe to archive'} onClick={onArchive}>
              Archive
            </Button>
          </div>
        </div>

        <div className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(124px,1fr))] gap-3.5 border-t border-divider pt-4">
          {stats.map((s) => (
            <div key={s.k}>
              <div className="text-[19px] font-black text-foreground tabular-nums">{s.v}</div>
              <div className="mt-0.5 text-caption text-faint">{s.k}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3.5 border-t border-divider pt-4">
          <div className="w-[236px] shrink-0">
            <FieldLabel>Lead</FieldLabel>
            <NativeSelect value={unit.leadId ?? ''} disabled={!canEdit} onChange={(e) => onLead(e.target.value)}>
              <option value="">{lead ? `Standing in: ${lead.name}` : 'No lead'}</option>
              {deep.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <FieldLabel>Order</FieldLabel>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon-sm" aria-label="Move up among its siblings" disabled={at <= 0} onClick={() => onNudge(-1)}>
                <ArrowUp className="size-3.5" />
              </Button>
              <Button variant="outline" size="icon-sm" aria-label="Move down among its siblings" disabled={at < 0 || at >= sibs.length - 1} onClick={() => onNudge(1)}>
                <ArrowDown className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="gap-0 overflow-clip py-0">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-divider px-5 py-4">
          <div className="text-overline text-faint">People in this unit</div>
          <span className="flex items-baseline gap-3 text-caption text-faint">
            {kids.length ? 'Direct members only — sub-units have their own' : 'Direct members'}
            <Link to="/$app" params={{ app: 'directory' }} search={{ scope: `group:${unit.id}` }} className="font-bold text-foreground underline-offset-2 outline-none hover:underline focus-visible:underline">
              View in Directory
            </Link>
          </span>
        </div>
        {direct.map((p) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenPerson(p.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), onOpenPerson(p.id))
            }}
            className="grid cursor-pointer grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-b border-divider px-5 py-3 outline-none last:border-b-0 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:grid-cols-[32px_minmax(0,1fr)_auto_auto]"
          >
            <PersonAvatar person={p} units={units} className="size-[30px]" fallbackClassName="text-[10.5px]" />
            <span className="min-w-0">
              <span className="block truncate text-ui-sm font-bold text-foreground">{p.name}</span>
              <span className="mt-0.5 block truncate text-caption text-faint">{p.title}</span>
            </span>
            <span className="hidden text-compact text-body sm:inline">{siteById(sites, p.primarySite)?.code ?? 'No site'}</span>
            <RoleBadge role={p.role} />
          </div>
        ))}
        {direct.length === 0 && (
          <div className="px-5 py-[18px] text-ui-sm text-body">
            No one sits directly in this unit. {kids.length ? `Its sub-units hold ${deep.length}.` : 'Add someone, or archive the unit.'}
          </div>
        )}
      </Card>
    </>
  )
}
