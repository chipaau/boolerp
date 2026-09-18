import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { FileDropzone } from '@workspace/ui/components/file-dropzone'
import { SelectField } from '@workspace/ui/components/select'
import { Switch } from '@workspace/ui/components/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table'
import { useToast } from '@workspace/ui/components/toast'
import { downloadCsv, parseCsv } from '@/lib/csv'
import { PersonAvatar } from '@/features/directory/people-bits'
import { APP_GOVERNS, APP_KEYS, APP_ROLES, NO_STOCK_PERMS, ROLE_TEMPLATE, deriveRole, fmtDate, liveUnits, parseDate, slugMail, unitPath } from '@/features/org/logic'
import { usePeople, usePersonActions, useSites, useUnits } from '@/features/org/queries'
import type { Perms, Person, PersonRole, Site, Unit } from '@/features/org/types'
import { FieldLabel } from './control-bits'

/** Every app's roles side by side; the current choice, when there is one, is filled in. */
export function PermsReferenceDialog({ open, onClose, current }: { open: boolean; onClose: () => void; current?: Perms }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[660px]" showCloseButton>
        <DialogHeader className="px-6 pt-[22px] pb-1 pr-14 text-left">
          <DialogTitle className="text-[19px] tracking-[-0.015em]">What each app role can do</DialogTitle>
          <DialogDescription className="mt-1.5 max-w-[62ch] text-compact leading-[1.55] text-pretty text-body">Every app defines its own roles — there is no shared ladder. This is the definition each app checks against, so changing one app never touches another.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[66vh] flex-col gap-3 overflow-y-auto px-6 py-4">
          {APP_KEYS.map((a) => (
            <div key={a} className="rounded-[14px] border border-border bg-surface-band px-4 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-ui font-black text-foreground">{a}</span>
                <span className="text-caption text-faint">{APP_GOVERNS[a]}</span>
              </div>
              <div className="mt-2">
                {APP_ROLES[a].map(([r, note]) => (
                  <div key={r} className="flex flex-wrap items-baseline gap-3 border-b border-divider py-2 last:border-b-0">
                    <Badge variant={current?.[a] === r ? 'success' : 'outline'} size="sm" className="min-w-[112px] justify-center">
                      {r}
                    </Badge>
                    <span className="min-w-[220px] flex-1 text-compact leading-[1.5] text-pretty text-body">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 pb-5 text-caption leading-[1.55] text-pretty text-faint">Approvals are separate: a chain names who signs, and an app role at manager level is what makes someone eligible for the first step.</div>
      </DialogContent>
    </Dialog>
  )
}

export type BulkKind = 'role' | 'unit' | 'access' | 'invite' | 'revoke'
const TITLES: Record<BulkKind, string> = { role: 'Change app role', unit: 'Move to another unit', access: 'Grant site access', invite: 'Resend the sign-in invitation', revoke: 'Revoke every access' }
const NOTES: Record<BulkKind, string> = {
  invite: 'A fresh sign-in link goes to each work email. Anyone who has exited is skipped.',
  revoke: 'Work site, storage access and every app role are cleared. The record, its history and approval entries stay.',
  role: 'Their per-app permissions reset to the template for the new role.',
  unit: 'Approvals and notifications that route by unit will follow them.',
  access: 'Existing access is kept — this only adds.',
}

/** One change across the selected people: a role template, a unit, a storage site, an invitation, or a revoke. */
export function BulkDialog({ kind, ids, onClose }: { kind: BulkKind | null; ids: string[]; onClose: () => void }) {
  const people = usePeople(), units = useUnits(), sites = useSites()
  const actions = usePersonActions()
  const toast = useToast()
  const [val, setVal] = useState('')
  const [keep, setKeep] = useState(true)
  useEffect(() => {
    if (!kind) return
    setVal(kind === 'role' ? 'Staff' : kind === 'unit' ? liveUnits(units)[0]?.id ?? '' : kind === 'access' ? sites[0]?.id ?? '' : '')
    setKeep(true)
  }, [kind, units, sites])
  const chosen = ids.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p)
  const exceptions = chosen.filter((p) => APP_KEYS.some((a) => p.perms[a] !== ROLE_TEMPLATE[p.role][a])).length
  const hasAccess = (p: Person) => !!(p.primarySite || p.access.length || APP_KEYS.some((a) => p.perms[a] !== 'None'))

  function apply() {
    if (!kind) return
    if (kind === 'invite') {
      const ok = chosen.filter((p) => p.status !== 'Exited')
      onClose()
      if (!ok.length) return toast('All of those have exited — nothing sent', { ok: false })
      actions.bulk(ok.map((p) => p.id), (p) => p, `sent a sign-in invitation`)
      return toast(`${ok.length} ${ok.length === 1 ? 'invitation' : 'invitations'} sent${ok.length < chosen.length ? ` · ${chosen.length - ok.length} skipped, already exited` : ''}`)
    }
    const label = `${ids.length} ${ids.length === 1 ? 'employee' : 'employees'}`
    if (kind === 'role') {
      const role = val as PersonRole
      actions.bulk(ids, (p) => {
        const next = { ...ROLE_TEMPLATE[role] }
        if (keep) APP_KEYS.forEach((a) => { if (p.perms[a] !== ROLE_TEMPLATE[p.role][a]) next[a] = p.perms[a] })
        return { ...p, role: deriveRole(next), perms: next }
      }, `role set to ${role}${keep ? ', per-app exceptions kept' : ''}`)
      toast(`${label} set to ${role}`)
    } else if (kind === 'unit') {
      actions.bulk(ids, (p) => ({ ...p, unitId: val }), `moved to ${unitPath(units, val)}`)
      toast(`${label} moved to ${unitPath(units, val)}`)
    } else if (kind === 'access') {
      const code = sites.find((s) => s.id === val)?.code ?? ''
      actions.bulk(ids, (p) => ({ ...p, access: p.access.includes(val) ? p.access : [...p.access, val] }), `given access to ${code}`)
      toast(`${label} given access to ${code}`)
    } else {
      actions.bulk(ids, (p) => ({ ...p, primarySite: null, access: [], role: 'Staff', perms: { ...NO_STOCK_PERMS } }), 'stripped of every site and app access')
      toast(`${label} stripped of every site and app access`, { ok: false })
    }
    onClose()
  }

  return (
    <Dialog open={kind !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[500px]" showCloseButton={false}>
        {kind && (
          <>
            <DialogHeader className="px-6 pt-[22px] pb-2 text-left">
              <DialogTitle className="text-[19px] tracking-[-0.015em]">{TITLES[kind]}</DialogTitle>
              <DialogDescription className="mt-1.5 text-compact leading-[1.55] text-pretty text-body">
                {ids.length} {ids.length === 1 ? 'employee' : 'employees'} selected. {NOTES[kind]}
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-2">
              {(kind === 'role' || kind === 'unit' || kind === 'access') && (
                <div className="mt-3">
                  <FieldLabel>{kind === 'role' ? 'New role' : kind === 'unit' ? 'Destination unit' : 'Site'}</FieldLabel>
                  <SelectField
                    aria-label="New value"
                    value={val}
                    onValueChange={setVal}
                    options={
                      kind === 'role'
                        ? ['Staff', 'Manager', 'Admin']
                        : kind === 'unit'
                          ? liveUnits(units).map((u) => ({ value: u.id, label: unitPath(units, u.id, ' › ') }))
                          : sites.map((s) => ({ value: s.id, label: `${s.name} · ${s.code}` }))
                    }
                  />
                </div>
              )}
              {kind === 'role' && (
                <>
                  <label className="mt-4 flex cursor-pointer items-center gap-3">
                    <Switch checked={keep} onCheckedChange={setKeep} />
                    <span className="min-w-0">
                      <span className="block text-ui-sm font-bold text-foreground">Keep per-app exceptions</span>
                      <span className="mt-0.5 block text-caption leading-[1.5] text-faint">{exceptions ? `${exceptions} of the selected ${exceptions === 1 ? 'person has' : 'people have'} an app set away from their template.` : 'None of the selected people have an app set away from their template.'}</span>
                    </span>
                  </label>
                  <div className="mt-3.5 rounded-xl border border-tone-warning bg-tone-warning-soft px-3.5 py-3 text-compact leading-[1.5] text-tone-warning-foreground">{keep ? `Apps already moved off someone's old template stay where they are. Everything else follows ${val}.` : `Any per-app tuning on these people is replaced by the ${val} template.`}</div>
                </>
              )}
              {(kind === 'invite' || kind === 'revoke') && (
                <div className="mt-3 rounded-[13px] border border-border bg-surface-band px-4 py-3.5">
                  <div className="mb-2 text-overline text-faint">{kind === 'revoke' ? 'Access to be removed' : 'Invitation goes to'}</div>
                  <ul className="flex flex-col gap-2">
                    {chosen.map((p) => {
                      const skip = kind === 'invite' ? p.status === 'Exited' : !hasAccess(p)
                      return (
                        <li key={p.id} className="flex items-center gap-2.5">
                          <PersonAvatar person={p} units={units} className="size-7" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-compact font-bold text-foreground">{p.name}</span>
                            <span className="block truncate text-caption text-faint">{kind === 'invite' ? p.email : `${p.primarySite ? `${sites.find((s) => s.id === p.primarySite)?.code ?? ''} · ` : ''}${APP_KEYS.filter((a) => p.perms[a] !== 'None').join(', ') || 'nothing to remove'}`}</span>
                          </span>
                          <Badge variant={skip ? 'outline' : kind === 'revoke' ? 'warning' : 'success'} size="sm">
                            {skip ? 'Skipped' : kind === 'invite' ? (p.status === 'Not started' ? 'First invite' : 'Resend') : 'Revoke'}
                          </Badge>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-[9px] px-6 pt-4 pb-[18px]">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button variant={kind === 'revoke' ? 'destructive' : 'default'} onClick={apply}>
                {kind === 'invite' ? 'Send to' : kind === 'revoke' ? 'Revoke for' : 'Apply to'} {ids.length}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

const IMPORT_COLUMNS = ['Name', 'Email', 'Job title', 'Unit', 'Work site', 'Reports to', 'Start date'] as const
type ImportRow = { line: number; name: string; email: string; title: string; unit?: Unit; site?: Site; mgr?: Person; start: string; errors: string[] }

/**
 * Upload a CSV of new employees: drop or browse a file, check every row (required fields, unknown
 * unit or site, duplicate email), then import the clean rows. Unknown names are reported, never guessed.
 */
export function ImportEmployeesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const units = useUnits(), people = usePeople(), sites = useSites()
  const actions = usePersonActions()
  const toast = useToast()
  const [file, setFile] = useState<{ file: File; text: string } | null>(null)
  useEffect(() => {
    if (open) setFile(null)
  }, [open])

  const parsed = useMemo(() => {
    if (!file) return null
    const live = liveUnits(units)
    const grid = parseCsv(file.text)
    if (!grid.length) return { error: 'The file is empty.', rows: [] as ImportRow[] }
    const head = grid[0].map((h) => h.toLowerCase())
    const col = (c: string) => head.indexOf(c.toLowerCase())
    const missing = ['Name', 'Unit'].filter((c) => col(c) < 0)
    if (missing.length) return { error: `The header row needs ${missing.join(' and ')} columns — download the template to see the layout.`, rows: [] as ImportRow[] }
    const cell = (r: string[], c: string) => (col(c) >= 0 ? (r[col(c)] ?? '').trim() : '')
    const low = (v: string) => v.toLowerCase()
    const taken = new Set(people.map((p) => low(p.email)))
    const seen = new Set<string>()
    const rows = grid.slice(1).map((r, i): ImportRow => {
      const errors: string[] = []
      const name = cell(r, 'Name'), unitName = cell(r, 'Unit'), siteName = cell(r, 'Work site'), mgrName = cell(r, 'Reports to'), startRaw = cell(r, 'Start date')
      const email = cell(r, 'Email') || (name ? slugMail(name) : '')
      if (!name) errors.push('Name is required')
      if (!unitName) errors.push('Unit is required')
      const unit = unitName ? live.find((u) => low(u.name) === low(unitName) || low(u.code) === low(unitName) || low(unitPath(units, u.id)) === low(unitName)) : undefined
      if (unitName && !unit) errors.push(`No unit “${unitName}”`)
      const site = siteName ? sites.find((s) => low(s.name) === low(siteName) || low(s.code) === low(siteName)) : undefined
      if (siteName && !site) errors.push(`No site “${siteName}”`)
      const mgr = mgrName ? people.find((p) => !p.external && (low(p.name) === low(mgrName) || low(p.id) === low(mgrName))) : undefined
      if (mgrName && !mgr) errors.push(`No one called “${mgrName}”`)
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`“${email}” is not an email`)
      else if (email && (taken.has(low(email)) || seen.has(low(email)))) errors.push(`${email} is already used`)
      if (email) seen.add(low(email))
      const d = startRaw ? parseDate(startRaw) : null
      if (startRaw && !d) errors.push(`Start date “${startRaw}” not understood`)
      return { line: i + 2, name, email, title: cell(r, 'Job title'), unit, site, mgr, start: d ? fmtDate(d) : '', errors }
    })
    return { error: rows.length ? '' : 'The file has a header row but no people.', rows }
  }, [file, people, units, sites])
  const ok = parsed?.rows.filter((r) => !r.errors.length) ?? []
  const bad = parsed?.rows.filter((r) => r.errors.length) ?? []

  function read(f: File) {
    f.text().then(
      (text) => setFile({ file: f, text }),
      () => toast('Could not read that file', { ok: false })
    )
  }
  function template() {
    const u = liveUnits(units).at(0), s = sites.at(0)
    downloadCsv('bool-employees-template.csv', [[...IMPORT_COLUMNS], ['Priya Nair', 'priya.nair@bool.co', 'Stock Controller', u?.name ?? '', s?.name ?? '', '', fmtDate(new Date())]])
  }
  function run() {
    if (!ok.length) return
    let code = actions.nextId()
    const made: Person[] = ok.map((r) => {
      const id = code
      code = id.replace(/\d+$/, (n) => String(Number(n) + 1).padStart(n.length, '0'))
      return { id, name: r.name, title: r.title || 'Job title not set', unitId: r.unit!.id, managerId: r.mgr?.id ?? null, status: 'Active', start: r.start, end: '', contract: 'Full-time', role: 'Staff', primarySite: r.site?.id ?? null, access: r.site ? [r.site.id] : [], phone: '', email: r.email, chat: '@' + r.email.split('@')[0], perms: { ...ROLE_TEMPLATE.Staff, Inventory: 'Viewer', Scan: 'None' } }
    })
    actions.importMany(made)
    toast(`${made.length} ${made.length === 1 ? 'employee' : 'employees'} imported${bad.length ? ` · ${bad.length} skipped` : ''}`)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[680px]" showCloseButton={false}>
        <DialogHeader className="px-6 pt-[22px] pb-2 text-left">
          <DialogTitle className="text-[19px] tracking-[-0.015em]">Import employees</DialogTitle>
          <DialogDescription className="mt-1.5 text-compact leading-[1.55] text-pretty text-body">
            A CSV with a header row: {IMPORT_COLUMNS.join(', ')}. Name and Unit are required. Units and sites must already exist — rows naming one that does not are skipped, never guessed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto px-6 pb-2">
          <FileDropzone file={file?.file ?? null} onFile={read} accept={['.csv', 'text/csv']} label="Drop a CSV here" hint="One person per row, with a header row" aria-label="Upload a CSV file" preview={false} />
          <button type="button" onClick={template} className="inline-flex items-center gap-1.5 self-start rounded text-compact font-bold text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            <Download className="size-3.5" strokeWidth={1.8} />
            Download template
          </button>
          {parsed?.error && <div className="rounded-xl border border-border bg-surface-band px-4 py-3 text-compact text-tone-danger-foreground">{parsed.error}</div>}
          {parsed && parsed.rows.length > 0 && (
            <>
              <div className="text-compact text-body">
                {ok.length} {ok.length === 1 ? 'row' : 'rows'} ready{bad.length ? ` · ${bad.length} will be skipped` : ' · every row checks out'}
              </div>
              <div className="overflow-clip rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="h-auto hover:bg-transparent">
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Check</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.rows.map((r) => (
                      <TableRow key={r.line} className="hover:bg-transparent">
                        <TableCell className="text-caption tabular-nums text-faint">{r.line}</TableCell>
                        <TableCell className="max-w-[220px]">
                          <span className="block truncate text-ui-sm font-bold text-foreground">{r.name || '—'}</span>
                          <span className="block truncate text-caption text-faint">{[r.email, r.title].filter(Boolean).join(' · ')}</span>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-compact">{r.unit ? unitPath(units, r.unit.id, ' › ') : '—'}</TableCell>
                        <TableCell className="text-compact whitespace-normal">
                          {r.errors.length ? <span className="text-tone-danger-foreground">{r.errors.join(' · ')}</span> : <Badge variant="success" size="sm">Ready</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-[9px] px-6 pt-4 pb-[18px]">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={run} disabled={!ok.length}>
            {ok.length ? `Import ${ok.length} ${ok.length === 1 ? 'employee' : 'employees'}` : 'Import'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
