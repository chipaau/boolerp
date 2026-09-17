import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, Download, Plus } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@workspace/ui/components/dropdown-menu'
import { EmptyState } from '@workspace/ui/components/empty-state'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { SearchField } from '@workspace/ui/components/search-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableToolbar } from '@workspace/ui/components/table'
import { useToast } from '@workspace/ui/components/toast'
import { ToneDot } from '@workspace/ui/components/tone-dot'
import { cn } from '@workspace/ui/lib/utils'
import { downloadCsv } from '@/lib/csv'
import { MODE_TONE, ascii, binCode, binFills, cadenceOf, fmtIsoDay, holidayOn, modeHint, nextCountDue, personById, siteById, siteTypeById } from '@/features/org/logic'
import { useAudit, useAuditLog, useCountries, useDefaultSite, useHolidays, usePeople, useRegions, useSiteActions, useSiteTypes, useSites } from '@/features/org/queries'
import { BinsDialog } from './bins-dialog'
import { ControlTitle, KeyValue, ModeBadge, Panel, Timeline, useCanEdit } from './control-bits'
import { SiteDialog } from './site-dialog'
import type { SiteDraft } from './site-dialog'

/** Every physical location that holds, moves or consumes stock. `?id=` opens one; `?filter=` presets a status or `new:<type>`. */
export function SitesPage() {
  const search = useSearch({ from: '/_app/$app/$section' })
  if (search.id) return <SiteDetail id={search.id} />
  return <SiteList />
}

function SiteList() {
  const sites = useSites(), types = useSiteTypes(), countries = useCountries(), regions = useRegions()
  const def = useDefaultSite()
  const canEdit = useCanEdit()
  const toast = useToast()
  const log = useAuditLog()
  function exportCsv() {
    const name = 'bool-sites.csv'
    downloadCsv(name, [['Code', 'Name', 'Region', 'Type', 'Status'], ...sites.map((s) => [s.code, s.name, s.region, siteTypeById(types, s.typeId).name, s.status])])
    log('Export', `${name} downloaded`)
    toast(`${name} downloaded`)
  }
  const navigate = useNavigate()
  const search = useSearch({ from: '/_app/$app/$section' })
  const preset = search.filter ?? ''
  const [type, setType] = useState('all')
  const [country, setCountry] = useState('all')
  const [status, setStatus] = useState(preset === 'Paused' || preset === 'Active' ? preset : 'all')
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState<SiteDraft | null>(preset.startsWith('new:') ? { typeId: preset.slice(4) } : null)
  useEffect(() => {
    if (preset === 'Paused' || preset === 'Active') setStatus(preset)
    if (preset.startsWith('new:')) setDraft({ typeId: preset.slice(4) })
  }, [preset])
  const on = countries.filter((c) => c.on).map((c) => c.name)
  const visible = useMemo(() => {
    const needle = ascii(q.trim())
    return sites.filter((s) => (type === 'all' || s.typeId === type) && (status === 'all' || s.status === status) && (country === 'all' || s.country === country) && (!needle || ascii(`${s.name} ${s.code} ${s.place} ${s.region} ${siteTypeById(types, s.typeId).name}`).includes(needle)))
  }, [sites, types, type, status, country, q])
  const groups = regions.filter((r) => on.includes(r.country)).map((r) => ({ label: `${r.name} · ${r.country}`, rows: visible.filter((s) => s.region === r.name && s.country === r.country) })).filter((g) => g.rows.length)
  const filtered = type !== 'all' || status !== 'all' || country !== 'all' || !!q
  const open = (id: string) => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'sites' }, search: { id } })
  const guard = (fn: () => void) => () => (canEdit ? fn() : toast('Read only as Staff — ask an Admin to change setup', { ok: false }))

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          overline="Inventory setup"
          title="Sites"
          description={type === 'all' ? 'Every physical location that holds, moves or consumes stock. Rules come from the site type.' : `Sites of type ${siteTypeById(types, type).name} — ${modeHint(siteTypeById(types, type).mode)}`}
          actions={
            <>
              <Button variant="outline" onClick={exportCsv}>
                <Download strokeWidth={1.8} />
                Export CSV
              </Button>
              <Button onClick={guard(() => setDraft({ typeId: type === 'all' ? undefined : type }))}>
                New site
                <ButtonArrow>
                  <Plus strokeWidth={2.2} />
                </ButtonArrow>
              </Button>
            </>
          }
        />
        <Card className="gap-0 overflow-clip py-0">
          <TableToolbar className="px-5">
            <SearchField size="sm" placeholder="Search sites, codes, places" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-[200px] max-w-xs" />
            <NativeSelect value={type} onChange={(e) => setType(e.target.value)} className="w-[190px]">
              <option value="all">All site types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {sites.filter((s) => s.typeId === t.id).length}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={country} onChange={(e) => setCountry(e.target.value)} className="w-[160px]">
              <option value="all">All countries</option>
              {on.map((c) => (
                <option key={c} value={c}>
                  {c} · {sites.filter((s) => s.country === c).length}
                </option>
              ))}
            </NativeSelect>
            {['all', 'Active', 'Paused'].map((s) => (
              <Badge key={s} variant={status === s ? 'filter-active' : 'filter'} render={<button type="button" onClick={() => setStatus(s)} />}>
                {s === 'all' ? 'All statuses' : s}
              </Badge>
            ))}
            <span className="flex-1" />
            <span className="text-caption text-faint">
              {visible.length} of {sites.length} sites
            </span>
            {filtered && (
              <Button variant="link" size="xs" onClick={() => { setType('all'); setStatus('all'); setCountry('all'); setQ('') }}>
                Clear filters
              </Button>
            )}
          </TableToolbar>
          {visible.length ? (
            <Table>
              <TableHeader>
                <TableRow className="h-auto hover:bg-transparent">
                  <TableHead>Site</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Site type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Stock on hand</TableHead>
                  <TableHead align="right">Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <GroupRows key={g.label} label={g.label} count={g.rows.length}>
                    {g.rows.map((s) => {
                      const t = siteTypeById(types, s.typeId)
                      return (
                        <TableRow key={s.id} className={cn('cursor-pointer', s.status === 'Paused' && 'opacity-70')} onClick={() => open(s.id)}>
                          <TableCell className="font-bold text-foreground">
                            <span className="flex items-center gap-2.5">
                              <ToneDot tone={MODE_TONE[t.mode]} shape="square" size={8} />
                              {s.name}
                              {def === s.id && <span className="text-caption font-normal text-faint">· default</span>}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-compact">{s.code}</TableCell>
                          <TableCell className="text-compact">{t.name}</TableCell>
                          <TableCell className="text-compact text-muted-foreground">{s.place} · {s.region}</TableCell>
                          <TableCell className="text-compact">{t.mode === 'None' ? 'Not stored' : s.lines ? `${s.lines} lines · ${s.value}` : 'Empty'}</TableCell>
                          <TableCell align="right">
                            <Badge variant={s.status === 'Active' ? 'success' : 'warning'} size="sm">
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell align="right">
                            <ChevronRight className="size-3.5 text-faint" strokeWidth={1.8} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </GroupRows>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title={filtered ? 'No sites match this search.' : 'No sites of this type yet.'} action={<Button variant="outline" size="sm" onClick={filtered ? () => { setType('all'); setStatus('all'); setCountry('all'); setQ('') } : guard(() => setDraft({}))}>{filtered ? 'Clear filters' : 'Add the first one'}</Button>} />
          )}
        </Card>
      </div>
      <SiteDialog draft={draft} onClose={() => setDraft(null)} onSaved={open} />
    </div>
  )
}

function GroupRows({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <>
      <TableRow className="h-auto hover:bg-transparent">
        <TableCell colSpan={7} className="border-b-0 bg-surface-band py-2">
          <span className="flex items-center justify-between gap-3">
            <span className="text-fine font-bold tracking-[0.04em] text-body">{label}</span>
            <span className="text-caption text-faint">{count === 1 ? '1 site' : `${count} sites`}</span>
          </span>
        </TableCell>
      </TableRow>
      {children}
    </>
  )
}

function SiteDetail({ id }: { id: string }) {
  const sites = useSites(), types = useSiteTypes(), people = usePeople(), audit = useAudit(), holidays = useHolidays()
  const def = useDefaultSite()
  const actions = useSiteActions()
  const canEdit = useCanEdit()
  const toast = useToast()
  const [draft, setDraft] = useState<SiteDraft | null>(null)
  const [bins, setBins] = useState(false)
  const s = siteById(sites, id)
  if (!s) return <EmptyState title="No such site" action={<Button variant="outline" size="sm" render={<Link to="/$app/$section" params={{ app: 'control-centre', section: 'sites' }} />}>All sites</Button>} className="py-24" />
  const t = siteTypeById(types, s.typeId)
  const cad = cadenceOf(s, t)
  const due = nextCountDue(s, t, new Date())
  const dueHoliday = due ? holidayOn(holidays, due, { site: s.id }) : undefined
  const owner = personById(people, s.ownerId)
  const parent = siteById(sites, s.parent)
  const fills = binFills(s)
  const over = fills.filter((p) => p >= 90).length
  const guard = (fn: () => void) => () => (canEdit ? fn() : toast('Read only as Staff — ask an Admin to change setup', { ok: false }))
  const movement = [
    ...audit.filter((a) => a.scope === 'Sites' && a.text.startsWith(s.name)).map((a) => ({ text: a.text.replace(`${s.name} `, ''), when: `${a.when} · ${a.who}` })),
    ...(s.lines ? [
      { text: `Goods receipt GR-4471 into ${s.code} · 18 lines booked in`, when: `Today, 09:12 · ${owner?.name ?? 'Site team'}` },
      { text: `Transfer TR-208 sent out of ${s.code}`, when: 'Yesterday, 16:40 · Tomas Vidal' },
      { text: t.cadence === 'None' ? 'Spot check closed with no variances' : `${t.cadence} count closed with 2 variances`, when: '4 Sep · Lieke de Vos' },
      { text: s.bins ? 'Bin A-02 marked quarantine' : 'Shipment held for inspection', when: '1 Sep · Milan Petrov' },
    ] : []),
  ]
  const rules = [
    { on: t.issue, text: t.issue ? 'Issuing allowed' : 'Issuing blocked' },
    { on: t.bins, text: t.bins ? 'Bins tracked' : 'No bins' },
    { on: cad.value !== 'None', text: `${cad.value === 'None' ? 'No routine counts' : `${cad.value} counts`}${cad.inherited ? '' : ' (site override)'}` },
    { on: t.negative, text: t.negative ? 'Negative stock allowed' : 'No negative stock' },
  ]

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          back={{ to: 'sites', label: 'All sites' }}
          title={s.name}
          description={
            <span className="block">
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral" size="sm" className="font-mono">
                  {s.code}
                </Badge>
                <Button variant="link" size="xs" render={<Link to="/$app/$section" params={{ app: 'control-centre', section: 'site-types' }} search={{ id: t.id }} />} className="text-compact">
                  {t.name}
                </Button>
                <ModeBadge mode={t.mode} />
                {t.mode !== 'None' && (
                  <Badge variant="success" size="sm">
                    Storage site
                  </Badge>
                )}
                {parent && (
                  <Badge variant="outline" size="sm" render={<Link to="/$app/$section" params={{ app: 'control-centre', section: 'sites' }} search={{ id: parent.id }} />}>
                    Under {parent.name}
                  </Badge>
                )}
                <Badge variant={s.status === 'Active' ? 'success' : 'warning'} size="sm">
                  {s.status}
                </Badge>
                {def === s.id && (
                  <Badge variant="warning" size="sm">
                    Default receiving site
                  </Badge>
                )}
              </span>
              <span className="mt-2 flex flex-wrap gap-x-2 text-compact">
                {rules.map((r, i) => (
                  <span key={r.text} className={r.on ? 'text-muted-foreground' : 'text-faint'}>
                    {i ? '· ' : ''}
                    {r.text}
                  </span>
                ))}
              </span>
            </span>
          }
          actions={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                  Manage site
                  <ChevronDown className="size-3.5" strokeWidth={1.7} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 p-1.5">
                  <DropdownMenuItem onClick={guard(() => setDraft({ edit: s }))}>Edit site details</DropdownMenuItem>
                  {t.bins && <DropdownMenuItem onClick={guard(() => setBins(true))}>{s.bins ? 'Edit bin layout' : 'Set up bins'}</DropdownMenuItem>}
                  {s.bins > 0 && <DropdownMenuItem onClick={() => toast(`${s.bins} bin labels sent to the label printer`)}>Print bin labels</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => toast(t.issue ? `Opening the issue form in Inventory for ${s.name}` : `${t.name} blocks issuing — edit the type to allow it`, { ok: t.issue })}>{t.issue ? 'Issue goods' : `Issuing blocked by ${t.name}`}</DropdownMenuItem>
                  <DropdownMenuItem onClick={guard(() => { if (def === s.id) return toast(`${s.name} is already the default receiving site`); actions.setDefault(s.id); toast(`${s.name} is now the default receiving site in Inventory`) })}>{def === s.id ? 'Default receiving site ✓' : 'Make default receiving site'}</DropdownMenuItem>
                  <DropdownMenuItem onClick={guard(() => { const next = s.status === 'Active' ? 'Paused' : 'Active'; const undo = actions.setStatus(s.id, next); toast(`${s.name} ${next === 'Paused' ? 'paused — stock is frozen' : 'reactivated'}`, { ok: next === 'Active', undo: () => { undo(); toast(`${s.name} ${next === 'Paused' ? 'reactivated' : 'paused again'}`) } }) })} className={s.status === 'Active' ? 'text-tone-risk-foreground' : ''}>{s.status === 'Active' ? 'Pause site' : 'Reactivate site'}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button render={<Link to="/$app" params={{ app: 'inventory' }} />}>Open in Inventory</Button>
            </>
          }
        />

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <Panel heading="Stock at this site">
              {t.mode !== 'None' && s.lines ? (
                <>
                  <div className="mb-4 flex flex-wrap items-end gap-3">
                    <span className="text-[34px] leading-none font-bold tracking-[-0.03em] text-foreground">{s.value === '—' ? 'No value yet' : s.value}</span>
                    <span className="pb-0.5 text-compact leading-[1.5] text-faint">
                      {s.lines.toLocaleString()} stock lines{s.bins ? ` across ${s.bins} bins` : ''} · {t.name.toLowerCase()}
                    </span>
                  </div>
                  {s.bins > 0 && (
                    <div>
                      <div className="mb-[7px] flex items-baseline justify-between gap-3">
                        <span className="text-compact font-bold text-body">Bin utilisation</span>
                        <span className={cn('text-compact font-bold', s.util >= 85 ? 'text-tone-warning-foreground' : 'text-muted-foreground')}>{s.util}%</span>
                      </div>
                      <div className="h-[7px] overflow-hidden rounded-full bg-muted">
                        <span className={cn('block h-full rounded-full', s.util >= 85 ? 'bg-brand-soft' : 'bg-sage')} style={{ width: `${s.util}%` }} />
                      </div>
                      <div className="mt-[7px] text-caption leading-[1.5] text-faint">{over ? `Tight in places — ${over} ${over === 1 ? 'bin' : 'bins'} at or above 90%.` : 'Space to receive more stock at this site.'}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-ui-sm leading-[1.55] text-body">{t.mode === 'None' ? 'This site type holds no stock — anything delivered is consumed on arrival.' : 'No stock here yet. Receive goods in Inventory to get started.'}</div>
              )}
            </Panel>
            {t.bins && (
              <Panel heading="Shelves & bins" aside={<span className="flex items-center gap-3">{s.bins > 0 && <Button variant="link" size="xs" onClick={() => toast(`${s.bins} bin labels sent to the label printer`)}>Print labels</Button>}{s.bins > 0 && <Button variant="link" size="xs" onClick={guard(() => setBins(true))}>Edit layout</Button>}</span>}>
                {s.bins ? (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-2.5">
                      <span className="text-caption text-faint">
                        {s.bins} bins in {s.aisles || Math.ceil(s.bins / (s.per || 4))} aisles · showing first {Math.min(s.bins, 12)}
                      </span>
                      {over > 0 && (
                        <Badge variant="warning" size="sm">
                          {over} at 90%+
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
                      {Array.from({ length: Math.min(s.bins, 12) }, (_, i) => {
                        const pct = fills[i] ?? 0
                        return (
                          <div key={i} className={cn('rounded-[10px] bg-surface-band px-3 py-2.5', pct >= 90 && 'shadow-[inset_0_0_0_1.5px_var(--brand-soft)]')}>
                            <div className="font-mono text-compact font-bold text-foreground">{binCode(Math.floor(i / (s.per || 4)), i % (s.per || 4))}</div>
                            <div className={cn('mt-[3px] text-caption', pct >= 90 ? 'text-tone-warning-foreground' : 'text-faint')}>{pct ? `${pct}% full` : 'Empty'}</div>
                            <div className="mt-[7px] h-1 overflow-hidden rounded-full bg-muted">
                              <span className={cn('block h-full rounded-full', pct >= 90 ? 'bg-brand-soft' : 'bg-sage')} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="text-ui-sm leading-[1.55] text-body">{t.name} tracks stock down to a bin, but this site has no bins yet — items here can only be found at site level.</div>
                    <Button variant="outline" size="sm" className="mt-3.5" onClick={guard(() => setBins(true))}>
                      Set up bins
                    </Button>
                  </div>
                )}
              </Panel>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <Panel heading="Details" aside={<Button variant="link" size="xs" onClick={guard(() => setDraft({ edit: s }))}>Edit</Button>}>
              <KeyValue rows={[
                { k: 'Site code', v: s.code, mono: true },
                { k: 'Site type', v: t.name },
                { k: 'Location', v: `${s.place} · ${s.region}` },
                { k: 'Address', v: s.addr },
                { k: 'Site manager', v: owner?.name ?? 'Unassigned', quiet: !owner },
                { k: 'Opened', v: s.opened },
                { k: 'Counting', v: cad.value === 'None' ? 'Not counted' : `${cad.value}${s.counted === '—' ? ' · never counted' : ` · last ${s.counted}`}` },
                ...(due ? [{ k: 'Next count due', v: dueHoliday ? <span className="text-tone-warning-foreground">{fmtIsoDay(due)} · {dueHoliday.name}, move it a day</span> : fmtIsoDay(due) }] : []),
                { k: 'Counting set by', v: cad.inherited ? 'Site type default' : `This site (type says ${cad.typeValue})` },
              ]} />
            </Panel>
            <Panel heading="Recent movement">
              {movement.length ? <Timeline items={movement} accent="amber" /> : <div className="text-ui-sm text-body">Nothing has moved here yet.</div>}
            </Panel>
          </div>
        </div>
      </div>
      <SiteDialog draft={draft} onClose={() => setDraft(null)} onSaved={() => undefined} />
      <BinsDialog site={bins ? s : null} onClose={() => setBins(false)} />
    </div>
  )
}
