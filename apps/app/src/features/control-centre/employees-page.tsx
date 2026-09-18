import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronRight, Download, MoreHorizontal, Plus } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { ConfirmDialog } from '@workspace/ui/components/confirm-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@workspace/ui/components/dropdown-menu'
import { EmptyState } from '@workspace/ui/components/empty-state'
import { SelectField } from '@workspace/ui/components/select'
import { SearchField } from '@workspace/ui/components/search-field'
import { Table, TableBody, TableBulkAction, TableBulkBar, TableCell, TableHead, TableHeader, TableRow, TableToolbar } from '@workspace/ui/components/table'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { BRAND } from '@/lib/brand'
import { downloadCsv } from '@/lib/csv'
import { PersonAvatar } from '@/features/directory/people-bits'
import { APP_KEYS, NO_STOCK_PERMS, appRoleRank, appsOn, ascii, directReports, liveUnits, personById, siteById, siteTypeById, tenure, unitDescendants, unitPath } from '@/features/org/logic'
import { useAudit, useAuditLog, usePeople, usePersonActions, useSiteTypes, useSites, useUnits } from '@/features/org/queries'
import type { PersonStatus } from '@/features/org/types'
import { ControlTitle, KeyValue, Panel, RoleBadge, RuleStrip, StatusBadge, Timeline, useCanEdit } from './control-bits'
import { BulkDialog, ImportEmployeesDialog, PermsReferenceDialog } from './employee-bulk'
import type { BulkKind } from './employee-bulk'
import { EmployeeDialog } from './employee-dialog'
import type { EmployeeDraft } from './employee-dialog'

const STATUSES: PersonStatus[] = ['Not started', 'Active', 'On leave', 'Exited']

/**
 * Every person, their unit, and what they can reach in each app. `?id=` opens one record;
 * `?filter=` presets the status (or `no-site`, or `new:<unit>` to start adding someone there).
 */
export function EmployeesPage() {
  const search = useSearch({ from: '/_app/$app/$section' })
  if (search.id) return <EmployeeDetail id={search.id} />
  return <EmployeeList />
}

function EmployeeList() {
  const units = useUnits(), people = usePeople(), sites = useSites()
  const canEdit = useCanEdit()
  const toast = useToast()
  const navigate = useNavigate()
  const search = useSearch({ from: '/_app/$app/$section' })
  const preset = search.filter ?? ''
  const [unit, setUnit] = useState('all')
  const [site, setSite] = useState(preset === 'no-site' ? 'none' : 'all')
  const [status, setStatus] = useState<string>(STATUSES.includes(preset as PersonStatus) ? preset : preset === 'no-site' ? 'Active' : 'Active')
  const [q, setQ] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState<EmployeeDraft | null>(preset.startsWith('new:') ? { unitId: preset.slice(4) } : null)
  const [bulk, setBulk] = useState<BulkKind | null>(null)
  const [importing, setImporting] = useState(false)
  const log = useAuditLog()
  useEffect(() => {
    if (STATUSES.includes(preset as PersonStatus)) setStatus(preset)
    if (preset === 'no-site') { setSite('none'); setStatus('Active') }
    if (preset.startsWith('new:')) setDraft({ unitId: preset.slice(4) })
  }, [preset])

  const internal = people.filter((p) => !p.external)
  const list = useMemo(() => {
    const needle = ascii(q.trim())
    return internal.filter((p) =>
      (unit === 'all' || p.unitId === unit || unitDescendants(units, unit).some((u) => u.id === p.unitId)) &&
      (site === 'all' || (site === 'none' ? !p.primarySite : p.primarySite === site || p.access.includes(site))) &&
      (status === 'all' || p.status === status) &&
      (!needle || ascii(`${p.name} ${p.id} ${p.title} ${unitPath(units, p.unitId)}`).includes(needle))
    )
  }, [internal, units, unit, site, status, q])
  const ids = Object.keys(checked).filter((k) => checked[k])
  const allChecked = list.length > 0 && list.every((p) => checked[p.id])
  const by = (s: PersonStatus) => internal.filter((p) => p.status === s).length
  const stranded = internal.filter((p) => p.status === 'Active' && !p.primarySite && appRoleRank('Inventory', p.perms.Inventory) >= 2 && p.role !== 'Admin').length
  const guard = (fn: () => void) => () => (canEdit ? fn() : toast('Read only as Staff — ask an Admin to change setup', { ok: false }))
  const open = (id: string) => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'employees' }, search: { id } })
  function exportCsv() {
    const name = 'bool-employees.csv'
    downloadCsv(name, [['Code', 'Name', 'Job title', 'Unit', 'Status', 'Contract', 'Email'], ...internal.map((p) => [p.id, p.name, p.title, unitPath(units, p.unitId), p.status, p.contract, p.email])])
    log('Export', `${name} downloaded`)
    toast(`${name} downloaded`)
  }

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          overline="Organisation"
          title="Employees"
          description="Every person, their unit, and what they can reach in each app. This is the record the Directory displays and Inventory checks before it lets anyone issue stock."
          actions={
            <>
<Button variant="outline" onClick={exportCsv}>
                <Download strokeWidth={1.8} />
                Export CSV
              </Button>
              <Button variant="outline" onClick={guard(() => setImporting(true))}>
                Import CSV
              </Button>
              <Button onClick={guard(() => setDraft({}))}>
                New employee
                <ButtonArrow>
                  <Plus strokeWidth={2.2} />
                </ButtonArrow>
              </Button>
            </>
          }
        />
        <RuleStrip>
          {by('Active')} active · {by('Not started')} not started · {by('On leave')} on leave · {by('Exited')} exited · {stranded} with a stock role but no site
        </RuleStrip>

        <Card className="gap-0 overflow-clip py-0">
          <TableToolbar className="px-5">
            <SearchField size="sm" placeholder="Search people, IDs, titles" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-[200px] max-w-xs" />
            <SelectField
              aria-label="Unit"
              value={unit}
              onValueChange={setUnit}
              className="w-[200px]"
              options={[{ value: 'all', label: 'All units' }, ...liveUnits(units).map((u) => ({ value: u.id, label: unitPath(units, u.id, ' › ') }))]}
            />
            <SelectField
              aria-label="Site"
              value={site}
              onValueChange={setSite}
              className="w-[180px]"
              options={[{ value: 'all', label: 'Any site' }, { value: 'none', label: 'No site assigned' }, ...sites.map((s) => ({ value: s.id, label: s.name }))]}
            />
            <SelectField
              aria-label="Status"
              value={status}
              onValueChange={setStatus}
              className="w-[150px]"
              options={['all', ...STATUSES].map((s) => ({ value: s, label: s === 'all' ? 'Any status' : s }))}
            />
            <span className="flex-1" />
            <span className="text-caption text-faint">
              {list.length} of {internal.length} people
            </span>
          </TableToolbar>

          {ids.length > 0 && (
            <TableBulkBar label={`${ids.length} ${ids.length === 1 ? 'employee' : 'employees'} selected`}>
              <TableBulkAction onClick={guard(() => setBulk('role'))}>Change app role</TableBulkAction>
              <TableBulkAction onClick={guard(() => setBulk('unit'))}>Move to unit</TableBulkAction>
              <TableBulkAction onClick={guard(() => setBulk('access'))}>Grant site access</TableBulkAction>
              <TableBulkAction onClick={guard(() => setBulk('invite'))}>Resend invitation</TableBulkAction>
              <TableBulkAction className="bg-tone-risk text-card shadow-none hover:bg-tone-risk/90 dark:bg-tone-risk dark:text-surface-inverted-foreground" onClick={guard(() => setBulk('revoke'))}>Revoke access</TableBulkAction>
              <TableBulkAction className="bg-transparent opacity-75 shadow-none dark:bg-transparent" onClick={() => setChecked({})}>
                Clear
              </TableBulkAction>
            </TableBulkBar>
          )}

          {list.length ? (
            <Table>
              <TableHeader>
                <TableRow className="h-auto hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox aria-label="Select all" checked={allChecked} indeterminate={ids.length > 0 && !allChecked} onCheckedChange={(v) => setChecked(v ? Object.fromEntries(list.map((p) => [p.id, true])) : {})} />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Work site</TableHead>
                  <TableHead>App role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((p) => {
                  const ws = siteById(sites, p.primarySite)
                  return (
                    <TableRow key={p.id} selected={!!checked[p.id]} className={cn('cursor-pointer', p.status === 'Exited' && 'opacity-60')} onClick={() => open(p.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox aria-label={`Select ${p.name}`} checked={!!checked[p.id]} onCheckedChange={(v) => setChecked((c) => ({ ...c, [p.id]: !!v }))} />
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <span className="flex items-center gap-[11px]">
                          <PersonAvatar person={p} units={units} className="size-8" />
                          <span className="min-w-0">
                            <span className="block truncate text-ui-sm font-bold text-foreground">{p.name}</span>
                            <span className="block truncate text-caption text-faint">
                              {p.id} · {p.title}
                            </span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-compact">{unitPath(units, p.unitId, ' › ')}</TableCell>
                      <TableCell className="text-compact">{ws ? `${ws.name}${p.access.length > 1 ? ` +${p.access.length - 1}` : ''}` : '—'}</TableCell>
                      <TableCell>
                        <RoleBadge role={p.role} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell align="right">
                        <ChevronRight className="size-3.5 text-faint" strokeWidth={1.8} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="No employees match those filters" description="Try another unit, site or status, or clear the search." action={<Button variant="outline" size="sm" onClick={() => { setUnit('all'); setSite('all'); setStatus('all'); setQ('') }}>Show everyone</Button>} />
          )}
        </Card>
      </div>
      <EmployeeDialog draft={draft} onClose={() => setDraft(null)} onSaved={open} />
      <BulkDialog kind={bulk} ids={ids} onClose={() => { setBulk(null); setChecked({}) }} />
      <ImportEmployeesDialog open={importing} onClose={() => setImporting(false)} />
    </div>
  )
}

function EmployeeDetail({ id }: { id: string }) {
  const units = useUnits(), people = usePeople(), sites = useSites(), types = useSiteTypes(), audit = useAudit()
  const actions = usePersonActions()
  const canEdit = useCanEdit()
  const toast = useToast()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<EmployeeDraft | null>(null)
  const [bulk, setBulk] = useState<BulkKind | null>(null)
  const [ref, setRef] = useState(false)
  const [exiting, setExiting] = useState(false)
  const p = personById(people, id)
  const today = useMemo(() => new Date(), [])
  const open = (pid: string) => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'employees' }, search: { id: pid } })
  if (!p) return <EmptyState title="No such employee" description="The record may have been removed." action={<Button variant="outline" size="sm" render={<Link to="/$app/$section" params={{ app: 'control-centre', section: 'employees' }} />}>All employees</Button>} className="py-24" />

  const mgr = personById(people, p.managerId)
  const reports = directReports(people, p.id)
  const work = siteById(sites, p.primarySite)
  const store = sites.filter((s) => p.access.includes(s.id))
  const on = appsOn(p.perms)
  const pre = p.status === 'Not started'
  const guard = (fn: () => void) => () => (canEdit ? fn() : toast('Read only as Staff — ask an Admin to change setup', { ok: false }))
  const onboarding = [
    { label: 'Record created', note: p.id, on: true },
    { label: 'Unit and manager set', note: mgr?.name ?? 'top of the tree', on: !!p.unitId },
    { label: 'App access granted', note: on.length ? `${on.length} of ${APP_KEYS.length} apps` : 'nothing switched on', on: on.length > 0 },
    { label: 'Work site assigned', note: work?.code ?? 'none yet', on: !!work },
    { label: 'Badge issued', note: p.badge ?? 'not printed', on: !!p.badge },
    { label: 'Invitation sent', note: pre ? `held until ${p.start || 'start date'}` : p.email, on: !pre },
  ]
  const done = onboarding.filter((o) => o.on).length
  const docs = [
    { name: 'Signed contract', meta: p.start ? `Dated ${p.start}` : 'Awaiting start date', on: !pre },
    { name: 'ID or passport copy', meta: pre ? 'Requested' : 'Verified by People Operations', on: !pre },
    { name: 'Bank details', meta: pre ? 'Awaiting' : 'On file', on: !pre },
    { name: 'Handbook acknowledgement', meta: p.emergency ? 'Signed' : 'Not returned', on: !!p.emergency },
  ]
  const history = [
    ...(p.end ? [{ text: 'Left the organisation', when: p.end }] : []),
    ...audit.filter((a) => a.text.includes(p.name)).map((a) => ({ text: a.text, when: `${a.when} · ${a.who}` })),
    { text: `Joined as ${p.title} in ${unitPath(units, p.unitId)}`, when: p.start || 'start date not recorded' },
  ]
  const meta = [p.id, p.contract, p.start ? `joined ${p.start}` : '', tenure(p.start, today) === '—' ? '' : `${tenure(p.start, today)} with ${BRAND.name}`, `${on.length} of ${APP_KEYS.length} apps`, work ? `based at ${work.code}` : 'no work site', store.length ? `${store.length} storage ${store.length === 1 ? 'site' : 'sites'}` : 'no storage access'].filter(Boolean).join(' · ')

  const askExit = () => {
    if (!canEdit) return toast('Read only as Staff — ask an Admin to change setup', { ok: false })
    if (p.status === 'Exited') return toast(`${p.name} has already exited`)
    const managed = sites.filter((s) => s.ownerId === p.id)
    if (managed.length) return toast(`Still site manager at ${managed.map((s) => s.code).join(', ')} — hand that over first`, { ok: false })
    if (reports.length) return toast(`${reports.length} ${reports.length === 1 ? 'person reports' : 'people report'} to them — reassign first`, { ok: false })
    setExiting(true)
  }

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          back={{ to: 'employees', label: 'All employees' }}
          title={
            <span className="flex items-center gap-4">
              <PersonAvatar person={p} units={units} className="size-[62px]" fallbackClassName="text-[21px]" />
              <span className="min-w-0">
                <span className="block text-pretty">{p.name}</span>
                <span className="mt-2 flex flex-wrap items-baseline gap-2 text-ui-sm font-normal tracking-normal">
                  <span className="text-body">{p.title}</span>
                  <span className="text-faint">/</span>
                  <Button variant="link" size="xs" render={<Link to="/$app/$section" params={{ app: 'control-centre', section: 'units' }} search={{ id: p.unitId ?? undefined }} />} className="text-compact">
                    {unitPath(units, p.unitId, ' › ')}
                  </Button>
                </span>
                <span className="mt-2.5 flex items-center gap-1.5">
                  <StatusBadge status={p.status} />
                  <RoleBadge role={p.role} />
                </span>
              </span>
            </span>
          }
          actions={
            <>
              <Button onClick={guard(() => setDraft({ edit: p }))}>Edit</Button>
              <Button variant="outline" onClick={() => toast(p.status === 'Exited' ? `${p.name} has exited — no invitation sent` : `Invitation sent to ${p.email}`)}>
                {pre ? 'Send invite' : 'Resend invite'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="icon" />} aria-label="More actions">
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1.5">
                  <DropdownMenuItem onClick={guard(() => setBulk('unit'))}>Move to another unit</DropdownMenuItem>
                  <DropdownMenuItem onClick={guard(() => setBulk('access'))}>Grant site access</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast('Badge label sent to the label printer')}>Print badge label</DropdownMenuItem>
                  <DropdownMenuItem onClick={askExit} className="text-tone-risk-foreground">{p.status === 'Exited' ? 'Already exited' : 'Mark as exited'}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
        <div className="mb-[22px] border-b border-divider pb-5 text-compact leading-[1.6] text-pretty text-faint">{meta}</div>

        <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,292px)_minmax(0,1fr)]">
          <Panel heading="Contact" aside={<Button variant="link" size="xs" onClick={guard(() => setDraft({ edit: p, step: 1 }))}>Edit</Button>}>
            <KeyValue rows={[
              { k: 'Email', v: p.email },
              { k: 'Phone', v: p.phone || 'Not on record', mono: true, quiet: !p.phone },
              { k: 'ID', v: p.id, mono: true },
              { k: 'Badge', v: p.badge ?? 'Not issued', mono: true, quiet: !p.badge },
            ]} />
            <div className="mt-5 border-t border-divider pt-[18px]">
              <div className="text-overline text-faint">Reports to</div>
              {mgr ? (
                <button type="button" onClick={() => open(mgr.id)} className="-mx-2.5 mt-2 flex w-[calc(100%+20px)] items-center gap-[11px] rounded-[10px] px-2.5 py-2 text-left outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                  <PersonAvatar person={mgr} units={units} className="size-8" />
                  <span className="min-w-0">
                    <span className="block truncate text-ui-sm font-bold text-foreground">{mgr.name}</span>
                    <span className="block truncate text-caption text-faint">{mgr.title}</span>
                  </span>
                </button>
              ) : (
                <div className="mt-2 text-compact text-body">Top of the tree — reports to no one.</div>
              )}
            </div>
            {reports.length > 0 && (
              <div className="mt-5 border-t border-divider pt-[18px]">
                <div className="text-overline text-faint">Direct reports · {reports.length}</div>
                <ul className="mt-2 flex flex-col gap-px">
                  {reports.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => open(r.id)} className="-mx-2.5 flex w-[calc(100%+20px)] items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                        <PersonAvatar person={r} units={units} className="size-[26px]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-compact text-body">{r.name}</span>
                          <span className="block truncate text-caption text-faint">{r.title}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5 border-t border-divider pt-[18px]">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-overline text-faint">Emergency contact</div>
                <Button variant="link" size="xs" onClick={() => toast(p.emergency ? 'Emergency contacts are edited by People Operations' : `Ask ${p.name.split(' ')[0]} for an emergency contact`)}>
                  {p.emergency ? 'Update' : 'Request'}
                </Button>
              </div>
              {p.emergency ? (
                <div className="mt-2">
                  <div className="text-ui-sm font-bold text-foreground">{p.emergency.name}</div>
                  <div className="mt-0.5 text-caption text-faint">{p.emergency.relationship}</div>
                  <div className="mt-1.5 font-mono text-compact text-body">{p.emergency.phone}</div>
                </div>
              ) : (
                <div className="mt-2 text-compact text-body">Nothing on record yet.</div>
              )}
            </div>
          </Panel>

          <div className="flex min-w-0 flex-col gap-[18px]">
            <Panel heading="Access" aside={<span className="flex items-baseline gap-3.5"><Button variant="link" size="xs" onClick={() => setRef(true)}>What these roles mean</Button><Button variant="link" size="xs" onClick={guard(() => setDraft({ edit: p, step: 2 }))}>Edit</Button></span>}>
              <div className="text-caption leading-[1.5] text-faint">{pre ? `Held until ${p.start || 'their start date'} — no app will accept them before then.` : 'Set app by app.'}</div>
              <div className="mt-2">
                {APP_KEYS.map((a) => (
                  <div key={a} className="flex items-center gap-3 border-b border-divider py-2.5 last:border-b-0">
                    <span className="min-w-0 flex-1 text-ui-sm text-body">{a}</span>
                    <Badge variant={p.perms[a] === 'None' ? 'outline' : appRoleRank(a, p.perms[a]) >= 3 ? 'success' : 'neutral'} size="sm">
                      {p.perms[a]}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-5 border-t border-divider pt-[18px] sm:grid-cols-2">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-overline text-faint">Work site</div>
                    <Button variant="link" size="xs" onClick={guard(() => setDraft({ edit: p, step: 3 }))}>Edit</Button>
                  </div>
                  {work ? (
                    <Link to="/$app/$section" params={{ app: 'control-centre', section: 'sites' }} search={{ id: work.id }} className="-mx-2.5 mt-1.5 flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', work.status === 'Paused' ? 'bg-brand-soft' : 'bg-sage')} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-ui-sm font-bold text-foreground">{work.name}</span>
                        <span className="block text-caption text-faint">
                          {work.code} · {siteTypeById(types, work.typeId).name} · {work.place}
                        </span>
                      </span>
                    </Link>
                  ) : (
                    <div className="mt-2 text-compact leading-[1.55] text-body">None — the Directory shows them without a location.</div>
                  )}
                </div>
                <div>
                  <div className="text-overline text-faint">Storage sites · {store.length}</div>
                  {store.length ? (
                    <ul className="mt-1.5 flex flex-col gap-px">
                      {store.map((s) => (
                        <li key={s.id}>
                          <Link to="/$app/$section" params={{ app: 'control-centre', section: 'sites' }} search={{ id: s.id }} className="-mx-2.5 flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                            <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', s.status === 'Paused' ? 'bg-brand-soft' : 'bg-sage-soft')} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-ui-sm font-bold text-foreground">{s.name}</span>
                              <span className="block text-caption text-faint">
                                {s.code} · {siteTypeById(types, s.typeId).name}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-compact leading-[1.55] text-body">None — every stock action in Inventory and Scan is refused.</div>
                  )}
                </div>
              </div>
            </Panel>

            <Panel heading="Onboarding" aside={<span className="text-compact font-bold text-body">{done} of {onboarding.length} done</span>}>
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-sage" style={{ width: `${Math.round((done / onboarding.length) * 100)}%` }} />
              </div>
              <ul className="grid gap-x-[22px] gap-y-0.5 sm:grid-cols-2">
                {onboarding.map((o) => (
                  <li key={o.label} className="flex items-start gap-2.5 py-[7px]">
                    <span aria-hidden="true" className={cn('mt-px grid size-[17px] shrink-0 place-items-center rounded-full text-[10px] font-black', o.on ? 'bg-sage text-sage-foreground' : 'shadow-[inset_0_0_0_1.5px_var(--input)]')}>{o.on ? '✓' : ''}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-ui-sm font-bold', o.on ? 'text-muted-foreground' : 'text-foreground')}>{o.label}</span>
                      <span className="mt-0.5 block truncate text-caption text-faint">{o.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel heading="Documents" aside={<Button variant="link" size="xs" onClick={() => toast('Document upload lives with People Operations')}>Upload</Button>}>
              {docs.map((d) => (
                <div key={d.name} className="flex items-center gap-3 border-b border-divider py-2.5 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block text-ui-sm text-body">{d.name}</span>
                    <span className="mt-0.5 block text-caption text-faint">{d.meta}</span>
                  </span>
                  <Badge variant={d.on ? 'neutral' : 'warning'} size="sm">
                    {d.on ? 'On file' : 'Missing'}
                  </Badge>
                </div>
              ))}
            </Panel>

            <Panel heading="History" aside={<Button variant="link" size="xs" render={<Link to="/$app/$section" params={{ app: 'control-centre', section: 'activity' }} search={{ q: p.name }} />}>Open activity log</Button>}>
              <Timeline items={history} />
            </Panel>
          </div>
        </div>
      </div>
      <EmployeeDialog draft={draft} onClose={() => setDraft(null)} onSaved={() => undefined} />
      <BulkDialog kind={bulk} ids={[p.id]} onClose={() => setBulk(null)} />
      <PermsReferenceDialog open={ref} onClose={() => setRef(false)} current={p.perms} />
      <ConfirmDialog
        open={exiting}
        title={`Mark ${p.name} as exited?`}
        description="Their record and history stay — reports, movements and audit entries keep the name. Site access and stock permissions are revoked straight away, so Inventory and Scan will refuse them from now on."
        action="Mark as exited"
        danger
        onClose={() => setExiting(false)}
        onConfirm={() => {
          const undo = actions.exit(p.id, { ...NO_STOCK_PERMS })
          setExiting(false)
          toast(`${p.name} exited — record and history kept`, { undo: () => { undo(); toast(`${p.name} restored`) } })
        }}
      />
    </div>
  )
}
