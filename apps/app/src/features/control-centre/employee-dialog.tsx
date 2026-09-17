import { useEffect, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Dialog, DialogContent } from '@workspace/ui/components/dialog'
import { DatePicker } from '@workspace/ui/components/date-picker'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { Stepper, StepperFooter, StepperLayout } from '@workspace/ui/components/stepper'
import { Switch } from '@workspace/ui/components/switch'
import { useToast } from '@workspace/ui/components/toast'
import { Badge } from '@workspace/ui/components/badge'
import { cn } from '@workspace/ui/lib/utils'
import { APP_GOVERNS, APP_KEYS, APP_ROLES, NO_STOCK_PERMS, ROLE_TEMPLATE, ROLE_TONE, appRoleNote, appsOn, deriveRole, fmtDate, isOnBooks, liveUnits, parseDate, siteTypeById, slugMail, unitPath } from '@/features/org/logic'
import { useCountries, useNumbering, usePeople, usePersonActions, useSiteTypes, useSites, useUnits } from '@/features/org/queries'
import type { Contract, Perms, Person, PersonStatus } from '@/features/org/types'
import { isoDate, parseIsoDate } from '@/lib/dates'
import { FieldLabel, fieldClass } from './control-bits'
import { PermsReferenceDialog } from './employee-bulk'

export type EmployeeDraft = { edit?: Person; step?: number; unitId?: string }
const STEPS = [
  { title: 'Person', hint: 'Name, unit, dates' },
  { title: 'Access', hint: 'A role in each app' },
  { title: 'Sites', hint: 'Work and storage' },
  { title: 'Review', hint: 'Check and invite' },
]
const STATUSES: PersonStatus[] = ['Not started', 'Active', 'On leave', 'Exited']
const CONTRACTS: Contract[] = ['Full-time', 'Part-time', 'Contract', 'Intern']
// the record keeps "9 Sep 2026"; the picker speaks ISO days
const toIso = (s: string) => { const d = parseDate(s); return d ? isoDate(d) : '' }
const fromIso = (iso: string) => (iso ? fmtDate(parseIsoDate(iso)) : '')

type Form = { name: string; code: string; title: string; phone: string; email: string; unitId: string; managerId: string; status: PersonStatus; start: string; end: string; contract: Contract; badge: string; perms: Perms; primary: string; access: string[]; welcome: boolean }

/**
 * Add or edit an employee in four steps: who they are, what they can reach (one role per app),
 * where they work (a work site, any number of storage sites), then a review before the record
 * is created and the invitation goes out. Only step one can refuse to move on.
 */
export function EmployeeDialog({ draft, onClose, onSaved }: { draft: EmployeeDraft | null; onClose: () => void; onSaved: (id: string) => void }) {
  const units = useUnits(), people = usePeople(), sites = useSites(), types = useSiteTypes(), countries = useCountries()
  const actions = usePersonActions()
  const nextId = useNumbering().find((r) => r.id === 'k-2')?.next ?? 'EMP-000'
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [country, setCountry] = useState('all')
  const [ref, setRef] = useState(false)
  const [f, setF] = useState<Form>(() => blank(nextId, draft?.unitId))
  const editing = draft?.edit

  useEffect(() => {
    if (!draft) return
    setStep(draft.step ?? 1)
    setCountry('all')
    const e = draft.edit
    setF(e ? { name: e.name, code: e.id, title: e.title, phone: e.phone, email: e.email, unitId: e.unitId ?? '', managerId: e.managerId ?? '', status: e.status, start: e.start, end: e.end, contract: e.contract, badge: e.badge ?? '', perms: { ...e.perms }, primary: e.primarySite ?? '', access: [...e.access], welcome: false } : blank(nextId, draft.unitId))
  }, [draft, nextId])

  const set = <TKey extends keyof Form>(k: TKey, v: Form[TKey]) => setF((x) => ({ ...x, [k]: v }))
  const on = countries.filter((c) => c.on).map((c) => c.name)
  const formSites = sites.filter((s) => country === 'all' || s.country === country)
  const storageSites = formSites.filter((s) => siteTypeById(types, s.typeId).mode !== 'None')
  const work = sites.find((s) => s.id === f.primary)
  const store = sites.filter((s) => f.access.includes(s.id))
  const derived = deriveRole(f.perms)
  const onApps = appsOn(f.perms)
  const mail = f.email.trim() || (f.name.trim() ? slugMail(f.name) : 'first.last@bool.co')

  function valid() {
    if (!f.name.trim()) { setStep(1); toast('An employee needs a name', { ok: false }); return false }
    if (!f.unitId) { setStep(1); toast('Pick an admin unit — the other apps use it for routing', { ok: false }); return false }
    return true
  }
  function go(n: number) {
    if (n > step && !valid()) return
    setStep(n)
  }
  function save() {
    if (!valid()) return
    if (f.status === 'Exited' && !f.end.trim()) return toast('An exited employee needs an end date', { ok: false })
    const exiting = f.status === 'Exited'
    const perms = exiting ? { ...NO_STOCK_PERMS } : { ...f.perms }
    const patch = {
      name: f.name.trim(), title: f.title.trim() || 'Job title not set', unitId: f.unitId, managerId: f.managerId || null, status: f.status, start: f.start.trim(), end: f.end.trim(), contract: f.contract,
      role: deriveRole(perms), primarySite: exiting ? null : f.primary || null, access: exiting ? [] : f.access, phone: f.phone.trim(), email: f.email.trim() || slugMail(f.name), perms, badge: f.badge.trim() || undefined,
    }
    if (editing) {
      actions.update(editing.id, patch)
      toast(editing.name !== patch.name ? 'Renamed — sites and reporting lines follow the record' : exiting && editing.status !== 'Exited' ? `${patch.name} exited — every site and app access revoked` : `${patch.name} updated`)
      onSaved(editing.id)
    } else {
      const id = f.code
      actions.create({ id, ...patch, chat: '@' + patch.email.split('@')[0] })
      toast(`${patch.name} added · ${id}${f.welcome ? ' · invitation sent' : ''}`)
      onSaved(id)
    }
    onClose()
  }

  const chip = (active: boolean, off = false) => cn('h-[30px] rounded-full px-3 text-fine font-bold outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring', active ? (off ? 'bg-muted text-body' : 'bg-sage text-sage-foreground') : 'text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-surface-soft')

  return (
    <Dialog open={draft !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[940px]" showCloseButton>
        <StepperLayout rail={<Stepper title={editing ? 'Editing' : 'New employee'} steps={STEPS} current={step - 1} complete={(i) => i > 0 || !!(f.name.trim() && f.unitId)} onStep={(i) => go(i + 1)} />}>
            <div className="mb-5 pr-8">
              <h2 className="text-[21px] leading-tight font-bold tracking-[-0.015em] text-foreground">{['', 'Who they are', 'What they can reach', 'Where they work', 'Check before you invite'][step]}</h2>
              <p className="mt-1.5 max-w-[58ch] text-compact leading-[1.55] text-pretty text-body">
                {[
                  '',
                  editing ? "Changes reach the Directory and every app's permission check immediately." : 'The ID comes from your numbering rules and is never reused. Name and admin unit are the only fields this form insists on.',
                  'Every app carries its own roles. Pick one per app — a person can be senior in Inventory and read-only everywhere else.',
                  'A work site is where they are based. A storage site is somewhere they may receive, issue and count stock — they can have several, or none.',
                  'Everything you have set, in one place. Change anything before the record is created.',
                ][step]}
              </p>
            </div>

            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[2fr_1fr]">
                  <div>
                    <FieldLabel>Full name</FieldLabel>
                    <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Priya Nair" className={fieldClass} autoFocus />
                  </div>
                  <div>
                    <FieldLabel>Employee ID</FieldLabel>
                    <div className="flex h-10 items-center rounded-[10px] bg-surface-band px-[13px] font-mono text-compact text-faint shadow-[inset_0_0_0_1px_var(--divider)]">{f.code}</div>
                  </div>
                </div>
                <div>
                  <FieldLabel>Job title</FieldLabel>
                  <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Stock Controller" className={fieldClass} />
                </div>
                <div>
                  <FieldLabel>Phone</FieldLabel>
                  <input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+960 330 1100" className={fieldClass} />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Work email</FieldLabel>
                  <input value={f.email} onChange={(e) => set('email', e.target.value)} placeholder={f.name.trim() ? slugMail(f.name) : 'name@bool.co'} className={fieldClass} />
                  <div className="mt-1.5 text-caption leading-[1.45] text-faint">{f.email.trim() ? 'The invitation and every sign-in link go to this address.' : `Left blank, we use ${mail} — the invitation goes there.`}</div>
                </div>
                <div>
                  <FieldLabel>Admin unit</FieldLabel>
                  <NativeSelect value={f.unitId} onChange={(e) => set('unitId', e.target.value)}>
                    <option value="">Pick a unit</option>
                    {liveUnits(units).map((u) => (
                      <option key={u.id} value={u.id}>
                        {unitPath(units, u.id, ' › ')}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <FieldLabel>Reports to</FieldLabel>
                  <NativeSelect value={f.managerId} onChange={(e) => set('managerId', e.target.value)}>
                    <option value="">No one — top of the tree</option>
                    {people.filter((p) => isOnBooks(p) && p.id !== editing?.id).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.title}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid gap-4 border-t border-divider pt-[18px] sm:col-span-2 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
                  <div>
                    <FieldLabel>Status</FieldLabel>
                    <NativeSelect value={f.status} onChange={(e) => set('status', e.target.value as PersonStatus)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div>
                    <FieldLabel>Start date</FieldLabel>
                    <DatePicker value={toIso(f.start)} onChange={(iso) => set('start', fromIso(iso))} placeholder="Pick a start date" aria-label="Start date" />
                  </div>
                  {f.status === 'Exited' && (
                    <div>
                      <FieldLabel>End date</FieldLabel>
                      <DatePicker value={toIso(f.end)} onChange={(iso) => set('end', fromIso(iso))} placeholder="Last working day" aria-label="End date" />
                    </div>
                  )}
                  <div>
                    <FieldLabel>Contract</FieldLabel>
                    <NativeSelect value={f.contract} onChange={(e) => set('contract', e.target.value as Contract)}>
                      {CONTRACTS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="sm:col-span-full">
                    <FieldLabel hint=" optional">Badge / NFC card</FieldLabel>
                    <input value={f.badge} onChange={(e) => set('badge', e.target.value)} placeholder="Scan the card, or leave blank to print one later" className={`${fieldClass} font-mono text-compact`} />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                  <div className="text-overline text-faint">One role per app</div>
                  <Button variant="link" size="xs" onClick={() => setRef(true)}>
                    Compare every role →
                  </Button>
                </div>
                <div className="flex flex-col gap-2.5">
                  {APP_KEYS.map((a) => (
                    <div key={a} className="rounded-[13px] bg-card p-3.5 shadow-[inset_0_0_0_1px_var(--input)]">
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <span className="text-ui-sm font-black text-foreground">{a}</span>
                        <span className="text-caption text-faint">{APP_GOVERNS[a]}</span>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {APP_ROLES[a].map(([r]) => (
                          <button key={r} type="button" onClick={() => set('perms', { ...f.perms, [a]: r })} className={chip(f.perms[a] === r, r === 'None')}>
                            {r}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2.5 text-caption leading-[1.5] text-pretty text-faint">{appRoleNote(a, f.perms[a])}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3.5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-band px-4 py-3">
                  <Badge variant={onApps.length ? ROLE_TONE[derived] : 'outline'} size="sm">
                    {onApps.length ? derived : 'No access'}
                  </Badge>
                  <span className="min-w-[220px] flex-1 text-compact leading-[1.5] text-pretty text-body">
                    {onApps.length === 0 ? 'Every app is off. They can sign in and will see nothing until an app is given a role.' : `${onApps.map((a) => `${a} as ${f.perms[a].toLowerCase()}`).join(' · ')}. Lists show them as ${derived}.`}
                  </span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                {on.length > 1 && (
                  <div className="mb-3.5 flex flex-wrap gap-1.5">
                    {['all', ...on].map((c) => (
                      <button key={c} type="button" onClick={() => setCountry(c)} className={chip(country === c)}>
                        {c === 'all' ? 'All countries' : c}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <div className="text-overline text-faint">Work site · where they are based</div>
                  <span className="text-caption text-faint">Pick one</span>
                </div>
                <div className="overflow-clip rounded-[13px] border border-border bg-surface-band">
                  {formSites.map((s) => (
                    <button key={s.id} type="button" onClick={() => set('primary', f.primary === s.id ? '' : s.id)} className="flex w-full items-center gap-3 border-b border-divider px-4 py-3 text-left outline-none last:border-b-0 hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring">
                      <span aria-hidden="true" className={cn('size-4 shrink-0 rounded-full transition-[box-shadow] duration-instant', f.primary === s.id ? 'shadow-[inset_0_0_0_5px_var(--sage)]' : 'shadow-[inset_0_0_0_1px_var(--input)]')} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-ui-sm font-bold text-foreground">{s.name}</span>
                        <span className="mt-0.5 block text-caption text-faint">
                          {s.code} · {s.place} · {s.region}
                        </span>
                      </span>
                    </button>
                  ))}
                  {!formSites.length && <div className="px-4 py-5 text-compact text-body">No sites in this country yet.</div>}
                </div>
                <div className="mt-5 mb-2 flex items-baseline justify-between gap-3">
                  <div className="text-overline text-faint">Storage sites · where they can move stock</div>
                  <span className="text-caption text-faint">{f.access.length || 'None'} selected</span>
                </div>
                <div className="overflow-clip rounded-[13px] border border-border bg-surface-band">
                  {storageSites.map((s) => {
                    const t = siteTypeById(types, s.typeId), has = f.access.includes(s.id)
                    return (
                      <label key={s.id} className="flex w-full cursor-pointer items-center gap-3 border-b border-divider px-4 py-3 last:border-b-0 hover:bg-surface-soft">
                        <Checkbox checked={has} onCheckedChange={(v) => set('access', v ? [...f.access, s.id] : f.access.filter((x) => x !== s.id))} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-ui-sm font-bold text-foreground">{s.name}</span>
                          <span className="mt-0.5 block text-caption text-faint">
                            {s.code} · {t.name}
                            {t.bins ? ' · bins tracked' : ''}
                          </span>
                        </span>
                        <Badge variant={s.id === f.primary ? 'success' : 'outline'} size="sm">
                          {s.id === f.primary ? 'Their work site' : t.mode}
                        </Badge>
                      </label>
                    )
                  })}
                  {!storageSites.length && <div className="px-4 py-5 text-compact text-body">No site here holds stock, so there is nothing to grant.</div>}
                </div>
                <div className="mt-3 text-caption leading-[1.5] text-pretty text-faint">
                  {work ? `Based at ${work.code}. ` : 'No work site — the Directory will show them without a location. '}
                  {store.length ? `Inventory and Scan will accept stock actions at ${store.map((s) => s.code).join(', ')} and nowhere else.` : 'With no storage site they can read Inventory and Scan, but every stock action will be refused.'}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <div className="flex flex-col gap-2.5">
                  {[
                    { title: 'Person', step: 1, lines: [['Name', f.name.trim() || 'Not set yet'], ['Job title', f.title.trim() || 'Not set'], ['Employee ID', f.code], ['Admin unit', f.unitId ? unitPath(units, f.unitId, ' › ') : 'Not set'], ['Reports to', people.find((p) => p.id === f.managerId)?.name ?? 'Nobody'], ['Email', mail], ['Employment', `${f.status} · ${f.contract}${f.start.trim() ? ` · from ${f.start}` : ''}`]] },
                    { title: 'Access', step: 2, lines: APP_KEYS.map((a) => [a, f.perms[a]]) },
                    { title: 'Sites', step: 3, lines: [['Work site', work ? `${work.name} · ${work.code}` : 'None'], ['Storage sites', store.length ? store.map((s) => s.code).join(', ') : 'None — no stock actions allowed'], ['Badge', f.badge.trim() || 'To be printed later']] },
                  ].map((b) => (
                    <div key={b.title} className="rounded-[13px] bg-card p-4 shadow-[inset_0_0_0_1px_var(--input)]">
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <span className="text-overline text-faint">{b.title}</span>
                        <Button variant="link" size="xs" onClick={() => go(b.step)}>
                          Edit
                        </Button>
                      </div>
                      {b.lines.map(([k, v]) => (
                        <div key={k} className="flex flex-wrap items-baseline gap-3.5 border-b border-divider py-[7px] last:border-b-0">
                          <span className="w-[112px] shrink-0 text-caption text-faint">{k}</span>
                          <span className={cn('min-w-0 flex-1 text-compact font-bold text-pretty', /^(None|Not set|Nobody|—)/.test(v) ? 'text-faint' : 'text-foreground')}>{v}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {(onApps.length === 0 || !work) && (
                  <div className="mt-3 rounded-xl border border-tone-warning bg-tone-warning-soft px-4 py-3 text-compact leading-[1.5] text-pretty text-tone-warning-foreground">
                    {onApps.length === 0 ? 'No app is switched on — they will be able to sign in and see nothing. Go back to Access if that is not intended.' : 'No work site set. Fine for head-office roles; everyone who touches stock needs one.'}
                  </div>
                )}
                {!editing && (
                  <label className="mt-5 flex cursor-pointer items-center gap-3 border-t border-divider pt-[18px]">
                    <Switch checked={f.welcome} onCheckedChange={(v) => set('welcome', v)} />
                    <span className="min-w-0">
                      <span className="block text-ui-sm font-bold text-foreground">Send the invitation now</span>
                      <span className="mt-0.5 block text-caption leading-[1.5] text-faint">{f.welcome ? `A sign-in link goes to ${mail} the moment you save.` : 'No email goes out — you can invite them from their page whenever you like.'}</span>
                    </span>
                  </label>
                )}
              </div>
            )}

            <StepperFooter note={['', 'Name and admin unit are the only things this form insists on.', onApps.length ? `${onApps.length} of ${APP_KEYS.length} apps switched on.` : 'No app switched on yet.', work ? (store.length ? `${store.length} storage ${store.length === 1 ? 'site' : 'sites'}.` : 'No storage access yet.') : 'No work site — you can set one later.', 'Nothing is saved until you add them.'][step]}>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))}>
                  Back
                </Button>
              )}
              {(step > 1 || editing) && (
                <Button variant={step === 4 || editing ? 'default' : 'outline'} onClick={save}>
                  {editing ? 'Save changes' : step === 4 ? 'Add employee' : 'Save & finish'}
                </Button>
              )}
              {step < 4 && <Button onClick={() => go(step + 1)}>{step === 1 ? 'Continue' : step === 3 ? 'Review' : 'Next'}</Button>}
            </StepperFooter>
        </StepperLayout>
      </DialogContent>
      <PermsReferenceDialog open={ref} onClose={() => setRef(false)} current={f.perms} />
    </Dialog>
  )
}

function blank(code: string, unitId?: string): Form {
  return { name: '', code, title: '', phone: '', email: '', unitId: unitId ?? '', managerId: '', status: 'Active', start: '', end: '', contract: 'Full-time', badge: '', perms: { ...ROLE_TEMPLATE.Staff }, primary: '', access: [], welcome: true }
}
