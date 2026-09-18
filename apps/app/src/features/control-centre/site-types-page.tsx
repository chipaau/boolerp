import { useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronRight, Download, Plus } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { ConfirmDialog } from '@workspace/ui/components/confirm-dialog'
import { EmptyState } from '@workspace/ui/components/empty-state'
import { SelectField } from '@workspace/ui/components/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table'
import { useToast } from '@workspace/ui/components/toast'
import { ToneDot } from '@workspace/ui/components/tone-dot'
import { cn } from '@workspace/ui/lib/utils'
import { downloadCsv } from '@/lib/csv'
import { MODE_TONE, modeHint, modeLabel } from '@/features/org/logic'
import { useAudit, useAuditLog, useSiteTypeActions, useSiteTypes, useSites } from '@/features/org/queries'
import type { SiteType } from '@/features/org/types'
import { ControlTitle, FieldLabel, ModeBadge, Panel, Timeline, YesNo, useCanEdit, useIsAdmin } from './control-bits'
import { SiteTypeDialog } from './site-type-dialog'

/** Every site inherits its storage mode, issuing rights, bin tracking and counting default from its type. */
export function SiteTypesPage() {
  const search = useSearch({ from: '/_app/$app/$section' })
  if (search.id) return <SiteTypeDetail id={search.id} />
  return <SiteTypeList />
}

/** What a type means, as three or four rule cards. */
export function typeCaps(t: SiteType) {
  return [
    { on: t.mode !== 'None', label: modeLabel(t.mode), note: modeHint(t.mode) },
    { on: t.issue, label: t.issue ? 'Can issue goods' : 'Cannot issue goods', note: t.issue ? 'Staff here can issue stock to jobs, people or other sites.' : 'Stock can only arrive; issuing is blocked in Inventory.' },
    { on: t.bins, label: t.bins ? 'Shelves and bins tracked' : 'No bin tracking', note: t.bins ? 'Every item carries a bin location inside the site.' : 'Items are tracked at site level only.' },
    { on: t.cadence !== 'None', label: `${t.cadence === 'None' ? 'No routine counting' : `${t.cadence} cycle counts`} by default`, note: `${t.cadence === 'None' ? 'Inventory never schedules a count here unless a site overrides it. ' : `Inventory schedules a ${t.cadence.toLowerCase()} count and flags overdue sites, unless a site overrides it. `}${t.negative ? 'Stock may go negative and be reconciled later.' : 'Stock cannot go negative — issues are blocked until goods exist.'}` },
  ]
}

export function CapList({ caps }: { caps: ReturnType<typeof typeCaps> }) {
  return (
    <ul className="flex flex-col gap-2">
      {caps.map((c) => (
        <li key={c.label} className="flex items-start gap-[11px] rounded-[11px] bg-surface-band px-[13px] py-[11px]">
          <span aria-hidden="true" className={cn('grid size-[22px] shrink-0 place-items-center rounded-full text-xs font-bold', c.on ? 'bg-tone-success-soft text-tone-success-foreground' : 'bg-muted text-faint')}>{c.on ? '✓' : '—'}</span>
          <span className="min-w-0">
            <span className="block text-ui-sm font-bold text-foreground">{c.label}</span>
            <span className="mt-0.5 block text-caption leading-[1.45] text-faint">{c.note}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function SiteTypeList() {
  const types = useSiteTypes(), sites = useSites()
  const canEdit = useCanEdit()
  const toast = useToast()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<{ edit?: SiteType } | null>(null)
  const open = (id: string) => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'site-types' }, search: { id } })
  const count = (id: string) => sites.filter((s) => s.typeId === id).length
  const log = useAuditLog()
  function exportCsv() {
    const name = 'bool-site-types.csv'
    downloadCsv(name, [['Name', 'Storage', 'Can issue', 'Bins', 'Counting', 'Sites'], ...types.map((t) => [t.name, t.mode, t.issue ? 'Yes' : 'No', t.bins ? 'Yes' : 'No', t.cadence, count(t.id)])])
    log('Export', `${name} downloaded`)
    toast(`${name} downloaded`)
  }
  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          overline="Inventory setup"
          title="Site types"
          description="Set the rules once, then reuse them. Every site inherits its storage mode, issuing rights and bin tracking from the type you give it."
          actions={
            <>
              <Button variant="outline" onClick={exportCsv}>
                <Download strokeWidth={1.8} />
                Export CSV
              </Button>
              <Button onClick={() => (canEdit ? setDraft({}) : toast('Read only as Staff — ask an Admin to change setup', { ok: false }))}>
                New site type
                <ButtonArrow>
                  <Plus strokeWidth={2.2} />
                </ButtonArrow>
              </Button>
            </>
          }
        />
        <Card className="gap-0 overflow-clip py-0">
          <Table>
            <TableHeader>
              <TableRow className="h-auto hover:bg-transparent">
                <TableHead>Type</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>What it means</TableHead>
                <TableHead>Issue goods</TableHead>
                <TableHead>Shelves / bins</TableHead>
                <TableHead align="right">Sites</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => open(t.id)}>
                  <TableCell className="font-bold text-foreground">
                    <span className="flex items-center gap-2.5">
                      <ToneDot tone={MODE_TONE[t.mode]} shape="square" size={8} />
                      {t.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ModeBadge mode={t.mode} />
                  </TableCell>
                  <TableCell className="max-w-[360px] text-compact leading-[1.45] text-body">{t.desc}</TableCell>
                  <TableCell>
                    <YesNo on={t.issue} yes="Allowed" no="Blocked" />
                  </TableCell>
                  <TableCell>
                    <YesNo on={t.bins} yes="Tracked" no="Not used" />
                  </TableCell>
                  <TableCell align="right" className="text-muted-foreground tabular-nums">
                    {count(t.id) || 'None'}
                  </TableCell>
                  <TableCell align="right">
                    <ChevronRight className="size-3.5 text-faint" strokeWidth={1.8} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
      <SiteTypeDialog draft={draft} onClose={() => setDraft(null)} onSaved={open} />
    </div>
  )
}

function SiteTypeDetail({ id }: { id: string }) {
  const types = useSiteTypes(), sites = useSites(), audit = useAudit()
  const actions = useSiteTypeActions()
  const canEdit = useCanEdit(), isAdmin = useIsAdmin()
  const toast = useToast()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<{ edit?: SiteType } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [target, setTarget] = useState('')
  const t = types.find((x) => x.id === id)
  if (!t) return <EmptyState title="No such site type" action={<Button variant="outline" size="sm" render={<Link to="/$app/$section" params={{ app: 'control-centre', section: 'site-types' }} />}>All site types</Button>} className="py-24" />
  const used = sites.filter((s) => s.typeId === t.id)
  const overrides = used.filter((s) => s.cadence !== null).length
  const others = types.filter((x) => x.id !== t.id)
  const targetType = types.find((x) => x.id === target)
  const history = [...audit.filter((a) => a.scope === 'Site types' && a.text.startsWith(t.name)).map((a) => ({ text: a.text.replace(`${t.name} · `, ''), when: `${a.when} · ${a.who}` })), { text: 'Type created', when: '12 Mar 2021 · Sofie Bakker' }]
  const usesLabel = `${used.length === 1 ? '1 site uses this type' : `${used.length} sites use this type`}${overrides ? ` · ${overrides} ${overrides === 1 ? 'overrides' : 'override'} the counting default` : ''}`

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          back={{ to: 'site-types', label: 'All site types' }}
          title={t.name}
          description={
            <span className="flex items-center gap-2.5">
              <ModeBadge mode={t.mode} />
              <span>{usesLabel}</span>
            </span>
          }
          actions={
            <>
              <Button variant="outline" onClick={() => (canEdit ? setDraft({ edit: t }) : toast('Read only as Staff — ask an Admin to change setup', { ok: false }))}>
                Edit rules
              </Button>
              <Button variant="outline" className="text-tone-risk-foreground" onClick={() => (isAdmin ? (setTarget(others[0]?.id ?? ''), setDeleting(true)) : toast('Only Admins can delete site types', { ok: false }))}>
                Delete
              </Button>
              <Button onClick={() => void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'sites' }, search: { filter: `new:${t.id}` } })}>
                Add a site
                <ButtonArrow>
                  <Plus strokeWidth={2.2} />
                </ButtonArrow>
              </Button>
            </>
          }
        />
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Panel heading="Rules">
            <div className="mb-3.5 text-ui-sm leading-[1.6] text-body">{t.desc}</div>
            <CapList caps={typeCaps(t)} />
          </Panel>
          <div className="flex flex-col gap-4">
            <Panel heading="Sites using this type" aside={<span className="text-caption text-faint">{usesLabel}</span>}>
              {used.length ? (
                <ul>
                  {used.map((s) => (
                    <li key={s.id}>
                      <Link to="/$app/$section" params={{ app: 'control-centre', section: 'sites' }} search={{ id: s.id }} className="-mx-2.5 flex items-center gap-3 rounded-[10px] border-b border-divider px-2.5 py-[11px] outline-none last:border-b-0 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="min-w-0 flex-1">
                          <span className="block text-ui-sm font-bold text-foreground">{s.name}</span>
                          <span className="mt-0.5 block text-caption text-faint">
                            {s.code} · {s.place} · {s.region}
                          </span>
                        </span>
                        <Badge variant={s.status === 'Active' ? 'success' : 'warning'} size="sm">
                          {s.status}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-ui-sm leading-[1.55] text-body">No sites use this type yet.</div>
              )}
            </Panel>
            <Panel heading="Change history">
              <Timeline items={history} accent="amber" />
            </Panel>
          </div>
        </div>
      </div>
      <SiteTypeDialog draft={draft} onClose={() => setDraft(null)} onSaved={() => undefined} />
      <ConfirmDialog
        open={deleting}
        title={`Delete ${t.name}?`}
        description={used.length ? `${used.length === 1 ? '1 site still uses this type.' : `${used.length} sites still use this type.`} Sites cannot exist without one, so pick where they should go — their stock and bins are untouched, only the rules change.` : 'Nothing uses this type, so it can go straight away.'}
        action={used.length ? `Move ${used.length} and delete` : 'Delete type'}
        danger
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          if (used.length && !targetType) return toast('Pick a type to move those sites to', { ok: false })
          actions.remove(t.id, used.length ? target : null)
          setDeleting(false)
          toast(`${t.name} deleted${used.length ? ` · ${used.length} ${used.length === 1 ? 'site' : 'sites'} moved` : ''}`, { ok: false })
          void navigate({ to: '/$app/$section', params: { app: 'control-centre', section: 'site-types' }, search: {} })
        }}
      >
        {used.length > 0 && (
          <div className="mt-2">
            <FieldLabel>Move those sites to</FieldLabel>
            <SelectField aria-label="Move sites to" value={target} onValueChange={setTarget} options={others.map((o) => ({ value: o.id, label: o.name }))} />
            {targetType && <div className="mt-2 rounded-[11px] bg-surface-band px-[13px] py-[11px] text-compact leading-[1.5] text-body">Those sites become {targetType.name}: {modeHint(targetType.mode).split('.')[0]}, {targetType.issue ? 'issuing allowed' : 'issuing blocked'}, {targetType.bins ? 'bins tracked' : 'no bin tracking'}.</div>}
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
