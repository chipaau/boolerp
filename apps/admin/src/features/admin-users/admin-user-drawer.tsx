import { useMemo, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import { DatePicker } from '@workspace/ui/components/date-picker'
import { Dialog, DialogContent } from '@workspace/ui/components/dialog'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { Stepper, StepperFooter, StepperLayout } from '@workspace/ui/components/stepper'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { Field, ReviewCard, StepHeading, fieldClass } from '@/components/form-field'
import { useTenantDirectory, useTenantProfileActions } from '@/features/tenants/queries'
import type { DirectoryTenant } from '@/features/tenants/types'
import { useAdminRoles, useAdminUserActions } from './queries'
import type { AdminRole, AdminUser, Nationality } from './types'

type Form = { name: string; idNo: string; email: string; contact: string; activeFrom: string; role: AdminRole; scope: string; nationality: Nationality }

const STEPS = [
  { title: 'Role & scope', hint: 'What they can run' },
  { title: 'Person', hint: 'Who gets the invite' },
  { title: 'Review', hint: 'Check and send' },
]
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
const pad = (n: number) => String(n).padStart(2, '0')
/** '01 Jan 2024' → '2024-01-01'; '' for '—' or anything unparseable. */
const toIso = (s: string) => {
  const d = new Date(s)
  return !s || s === '—' || Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** '2024-01-01' → '01 Jan 2024'. */
const fromIso = (iso: string) => (iso ? new Date(`${iso}T00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '')

/**
 * Add or edit an admin user in a stepped dialog (the same pattern as New tenant and New employee):
 * role & scope, then the person, then a review before the invite goes out. Pass `editing` to edit an
 * accepted user. Pass `tenant` to add an admin to that tenant: the role is fixed to Tenant admin,
 * the scope to the tenant, and the person is added to the tenant's admin list.
 */
export function AdminUserDialog({ open, editing, tenant, onClose }: { open: boolean; editing?: AdminUser; tenant?: DirectoryTenant; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[940px]" showCloseButton>
        {open && <AdminUserFlow key={editing?.idNo ?? tenant?.slug ?? 'new'} editing={editing} tenant={tenant} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

/** @deprecated Old name kept so existing imports keep compiling; it is now a stepped dialog. */
export const AdminUserDrawer = AdminUserDialog

function AdminUserFlow({ editing, tenant, onDone }: { editing?: AdminUser; tenant?: DirectoryTenant; onDone: () => void }) {
  const roles = useAdminRoles()
  const { tenants } = useTenantDirectory()
  const { invite, update } = useAdminUserActions()
  const { addAdmin } = useTenantProfileActions()
  const toast = useToast()
  const scopes = useMemo(() => {
    const seen = new Set<string>()
    return tenants.filter((t) => t.directoryStatus !== 'archived' && !seen.has(t.abbr) && seen.add(t.abbr))
  }, [tenants])

  const [step, setStep] = useState(0)
  const [f, setF] = useState<Form>(() =>
    editing
      ? { name: editing.name, idNo: editing.idNo, email: editing.email, contact: editing.contact, activeFrom: toIso(editing.activeFrom), role: editing.role, scope: editing.scope, nationality: editing.nationality }
      : { name: '', idNo: '', email: '', contact: '', activeFrom: '', role: 'Tenant admin', scope: tenant?.abbr ?? '', nationality: 'Maldivian' }
  )
  const set = <TKey extends keyof Form>(k: TKey, v: Form[TKey]) => setF((x) => ({ ...x, [k]: v }))
  const expat = f.nationality === 'Expatriate'
  const tenantAdmin = f.role === 'Tenant admin'
  const scopeName = tenants.find((t) => t.abbr === f.scope)?.name

  const missing = (i: number): string[] => {
    const out: string[] = []
    if (i === 0 && tenantAdmin && (!f.scope || f.scope === 'All tenants')) out.push('the tenant this person runs')
    if (i === 1) {
      if (!f.name.trim()) out.push('a full name')
      if (!f.idNo.trim()) out.push(expat ? 'a passport number' : 'an ID number')
      if (!isEmail(f.email)) out.push('a valid e-mail')
    }
    return out
  }
  const complete = (i: number) => missing(i).length === 0
  const blocked = (i: number) => {
    const m = missing(i)
    if (!m.length) return false
    toast(`${STEPS[i].title} still needs ${m.join(', ')}.`, { ok: false })
    return true
  }
  const go = (n: number) => {
    if (n > step) {
      for (let i = 0; i < n; i++) if (blocked(i)) return setStep(i)
    }
    setStep(n)
  }

  const submit = () => {
    for (let i = 0; i < 2; i++) if (blocked(i)) return setStep(i)
    const scope = tenantAdmin ? f.scope : 'All tenants'
    const activeFrom = fromIso(f.activeFrom) || undefined
    const fields = { name: f.name.trim(), email: f.email.trim(), contact: f.contact.trim(), role: f.role, scope, nationality: f.nationality }
    if (tenant) {
      const undo = addAdmin(tenant.slug, { name: fields.name, idNo: f.idNo.trim(), email: fields.email }, tenant)
      toast(`Invite sent to ${fields.email}.`, { undo })
    } else if (editing) {
      const undo = update(editing.idNo, { ...fields, ...(activeFrom ? { activeFrom } : {}) })
      toast(`${fields.name} updated. Role and scope changes are logged.`, { undo })
    } else {
      const undo = invite({ ...fields, idNo: f.idNo.trim(), activeFrom })
      toast(`Invite sent to ${fields.email}.`, { undo })
    }
    onDone()
  }

  const heading: [string, string][] = [
    [tenant ? `An admin for ${tenant.abbr}` : 'What they can run', tenant ? 'Tenant admins run one tenant day to day. They cannot see or touch the others.' : 'Admin users run Hexa itself or a single tenant. Everyday staff live in each tenant’s own Control Centre.'],
    ['Who they are', editing ? 'The ID can’t change once invited. Everything else can.' : 'The invite link goes to their e-mail and expires in 14 days.'],
    ['Check before you send', editing ? 'Role and scope changes are logged and take effect on their next request.' : 'Nothing is sent until you confirm.'],
  ]
  const primary = editing ? 'Save changes' : 'Send invite'
  const chip = (active: boolean) =>
    cn('h-[30px] rounded-full px-3 text-fine font-bold outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring', active ? 'bg-sage text-sage-foreground' : 'text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-surface-soft')

  return (
    <StepperLayout rail={<Stepper title={editing ? 'Editing' : 'New admin user'} steps={STEPS} current={step} complete={complete} onStep={go} />}>
      <StepHeading title={heading[step][0]} lede={heading[step][1]} />

      {step === 0 && (
        <div>
          <div className="mb-2 text-overline text-faint">Role</div>
          {tenant ? (
            <div className="rounded-[13px] bg-surface-band p-3.5">
              <div className="text-ui-sm font-black text-foreground">Tenant admin</div>
              <div className="mt-0.5 text-caption text-faint">{roles.find((r) => r.key === 'Tenant admin')?.note}</div>
            </div>
          ) : (
            <div role="radiogroup" aria-label="Role" className="grid gap-2.5 sm:grid-cols-2">
              {roles.map((r) => {
                const on = f.role === r.key
                return (
                  <button
                    key={r.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setF((x) => ({ ...x, role: r.key, scope: r.key === 'Tenant admin' && !scopes.some((t) => t.abbr === x.scope) ? '' : x.scope }))}
                    className={cn(
                      'flex items-start gap-[11px] rounded-[13px] bg-card px-[15px] py-[13px] text-left outline-none transition-[box-shadow] duration-instant focus-visible:ring-2 focus-visible:ring-ring',
                      on ? 'shadow-[inset_0_0_0_1.5px_var(--sage)]' : 'shadow-[inset_0_0_0_1px_var(--input)] hover:bg-surface-soft'
                    )}
                  >
                    <span aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0 rounded-full', on ? 'shadow-[inset_0_0_0_5px_var(--sage)]' : 'shadow-[inset_0_0_0_1px_var(--input)]')} />
                    <span className="min-w-0">
                      <span className="block text-ui-sm font-bold text-foreground">{r.key}</span>
                      <span className="mt-0.5 block text-caption leading-[1.45] text-faint">{r.note}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {tenantAdmin && (
            <div className="mt-5 max-w-[420px] border-t border-divider pt-[18px]">
              {tenant ? (
                <Field label="Tenant this person runs">
                  <div className="flex h-10 items-center rounded-[10px] bg-surface-band px-[13px] text-sm font-bold text-foreground shadow-[inset_0_0_0_1px_var(--divider)]">
                    {tenant.name} · {tenant.abbr}
                  </div>
                </Field>
              ) : (
                <Field id="au-scope" label="Tenant this person runs">
                  <NativeSelect id="au-scope" value={f.scope} onChange={(e) => set('scope', e.target.value)}>
                    <option value="">Pick a tenant</option>
                    {scopes.map((t) => (
                      <option key={t.abbr} value={t.abbr}>
                        {t.name} · {t.abbr}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            </div>
          )}

          {f.role === 'Platform admin' && (
            <div className="mt-4 rounded-xl border border-tone-warning bg-tone-warning-soft px-4 py-3 text-compact leading-[1.5] text-pretty text-tone-warning-foreground">
              Platform admins can create, suspend and delete every tenant. Keep this list short.
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="mb-2 text-overline text-faint">Nationality</div>
          <div className="mb-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Nationality">
            <button type="button" role="radio" aria-checked={!expat} className={chip(!expat)} onClick={() => set('nationality', 'Maldivian')}>
              Maldivian — national ID
            </button>
            <button type="button" role="radio" aria-checked={expat} className={chip(expat)} onClick={() => set('nationality', 'Expatriate')}>
              Expatriate — passport
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="au-name" label="Full name">
              <input id="au-name" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Aishath Leena" className={fieldClass} />
            </Field>
            <Field id="au-id" label={expat ? 'Passport number' : 'ID number'} hint={editing ? 'The ID can’t change once invited.' : undefined}>
              <input id="au-id" value={f.idNo} onChange={(e) => set('idNo', e.target.value)} placeholder={expat ? 'P-8823441' : 'A123566'} disabled={!!editing} className={cn(fieldClass, 'font-mono text-compact')} />
            </Field>
            <Field id="au-email" label="E-mail address" className="sm:col-span-2" hint="The invite link goes here and expires in 14 days.">
              <input id="au-email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@hexa.co" className={fieldClass} />
            </Field>
            <Field id="au-contact" label="Contact number">
              <input id="au-contact" value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="7778899" inputMode="tel" className={fieldClass} />
            </Field>
            <Field id="au-from" label="Active from">
              <DatePicker id="au-from" value={f.activeFrom} onChange={(iso) => set('activeFrom', iso)} placeholder="From the day they accept" />
            </Field>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-2.5">
          <ReviewCard
            title="Role & scope"
            onEdit={() => setStep(0)}
            lines={[
              ['Role', f.role],
              ['Scope', tenantAdmin ? (scopeName ? `${scopeName} · ${f.scope}` : f.scope || 'Not set') : 'All tenants'],
            ]}
          />
          <ReviewCard
            title="Person"
            onEdit={() => setStep(1)}
            lines={[
              ['Name', f.name.trim() || 'Not set'],
              [expat ? 'Passport number' : 'ID number', f.idNo.trim() || 'Not set'],
              ['E-mail', f.email.trim() || 'Not set'],
              ['Contact number', f.contact.trim() || 'Not set'],
              ['Active from', fromIso(f.activeFrom) || '— from the day they accept'],
              ['Nationality', f.nationality],
            ]}
          />
        </div>
      )}

      <StepperFooter note={['Only the role and, for a tenant admin, the tenant are needed here.', 'Name, ID and e-mail are required.', editing ? 'Changes save immediately.' : 'The invite goes out when you send it.'][step]}>
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        {editing && step < 2 && (
          <Button variant="outline" onClick={submit}>
            {primary}
          </Button>
        )}
        {step < 2 ? <Button onClick={() => go(step + 1)}>{step === 1 ? 'Review' : 'Continue'}</Button> : <Button onClick={submit}>{primary}</Button>}
      </StepperFooter>
    </StepperLayout>
  )
}
