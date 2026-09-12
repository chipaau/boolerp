import { useEffect, useState } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { Switch } from '@workspace/ui/components/switch'
import { useToast } from '@workspace/ui/components/toast'
import { PersonAvatar } from '@/features/directory/people-bits'
import { APP_GOVERNS, APP_KEYS, APP_ROLES, NO_STOCK_PERMS, ROLE_TEMPLATE, deriveRole, liveUnits, slugMail, unitPath } from '@/features/org/logic'
import { usePeople, usePersonActions, useSites, useUnits } from '@/features/org/queries'
import type { Perms, Person, PersonRole } from '@/features/org/types'
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
                  <NativeSelect value={val} onChange={(e) => setVal(e.target.value)} className="[&>select]:h-10">
                    {kind === 'role' && ['Staff', 'Manager', 'Admin'].map((r) => <option key={r} value={r}>{r}</option>)}
                    {kind === 'unit' && liveUnits(units).map((u) => <option key={u.id} value={u.id}>{unitPath(units, u.id, ' › ')}</option>)}
                    {kind === 'access' && sites.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}
                  </NativeSelect>
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

/** Paste rows: name, job title, admin unit, reports to, start date. Unknown units are skipped, never guessed. */
export function ImportEmployeesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const units = useUnits(), people = usePeople()
  const actions = usePersonActions()
  const toast = useToast()
  const [text, setText] = useState('')
  useEffect(() => { if (open) setText('') }, [open])
  const rows = text.split('\n').map((r) => r.trim()).filter(Boolean)
  const parsed = rows.map((r) => {
    const c = r.split(',').map((x) => x.trim())
    const unit = liveUnits(units).find((u) => u.name.toLowerCase() === (c[2] ?? '').toLowerCase())
    return { name: c[0] ?? '', title: c[1] ?? '', unit, mgr: people.find((p) => p.name.toLowerCase() === (c[3] ?? '').toLowerCase()), start: c[4] ?? '' }
  }).filter((r) => r.name)
  const ok = parsed.filter((r) => r.unit), bad = parsed.filter((r) => !r.unit)
  const live = liveUnits(units)
  function run() {
    if (!parsed.length) return toast('Paste at least one row', { ok: false })
    if (!ok.length) return toast(`Nothing imported — no unit “${bad[0]?.name ?? ''}”`, { ok: false })
    let code = actions.nextId()
    const made: Person[] = ok.map((r) => {
      const id = code
      code = id.replace(/\d+$/, (n) => String(Number(n) + 1).padStart(n.length, '0'))
      const email = slugMail(r.name)
      return { id, name: r.name, title: r.title || 'Job title not set', unitId: r.unit!.id, managerId: r.mgr?.id ?? null, status: 'Active', start: r.start || '', end: '', contract: 'Full-time', role: 'Staff', primarySite: null, access: [], phone: '', email, chat: '@' + email.split('@')[0], perms: { ...ROLE_TEMPLATE.Staff, Inventory: 'Viewer', Scan: 'None' } }
    })
    actions.importMany(made)
    toast(`${made.length} imported${bad.length ? ` · ${bad.length} skipped` : ''}`)
    onClose()
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[580px]" showCloseButton={false}>
        <DialogHeader className="px-6 pt-[22px] pb-2 text-left">
          <DialogTitle className="text-[19px] tracking-[-0.015em]">Import employees</DialogTitle>
          <DialogDescription className="mt-1.5 text-compact leading-[1.55] text-pretty text-body">One person per line: name, job title, admin unit, reports to, start date. The unit must already exist — rows naming an unknown unit are skipped and reported back, never guessed.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <FieldLabel>Rows</FieldLabel>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Priya Nair, Stock Controller, Warehouse, Sofie Bakker, 14 Sep 2026" className="w-full resize-y rounded-[12px] bg-surface-band px-[13px] py-3 font-mono text-compact leading-[1.6] text-foreground outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring" />
          <div className="mt-3 rounded-xl border border-border bg-surface-band px-4 py-3 text-compact leading-[1.55] text-body">
            {!rows.length ? `Nothing pasted yet. Unit names must match exactly — you have ${live.slice(0, 4).map((u) => u.name).join(', ')} and ${live.length - 4} more.` : `${ok.length} ${ok.length === 1 ? 'row' : 'rows'} ready${bad.length ? ` · ${bad.length} skipped for an unknown unit: ${bad.slice(0, 3).map((b) => b.name).join(', ')}` : ' · every unit matched'}`}
          </div>
        </div>
        <div className="flex items-center justify-end gap-[9px] px-6 pt-4 pb-[18px]">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={run}>{rows.length ? `Import ${rows.length} ${rows.length === 1 ? 'person' : 'people'}` : 'Import'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

