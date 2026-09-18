import { useState } from 'react'
import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { DatePicker } from '@workspace/ui/components/date-picker'
import { Dialog, DialogContent } from '@workspace/ui/components/dialog'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { Segmented, SegmentedItem } from '@workspace/ui/components/segmented'
import { Stepper, StepperFooter, StepperLayout } from '@workspace/ui/components/stepper'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { Field, ReviewCard, StepHeading, fieldClass } from '@/components/form-field'
import { useCurrentUser } from '@/components/layout/user-context'
import { useActiveCountries, useChildGeographies, useTopLevelGeographies } from '@/features/geographies/queries'
import { useAppCatalog, useCoreApps, useCreateTenant, useEntityTypes, useOrgTypes, usePlans, useTenantDirectory, useTenantProfileActions, useTenants } from './queries'
import type { AppName, CreateTenantInput, EntityType, Nationality, OrgType, PlanName, TenantAdmin, TenantApps, TenantProfile } from './types'

/** What the list shows after a successful provision: the one-time recovery link for the owner. */
export type Provisioned = { name: string; recoveryLink: string }

const STEPS = [
  { title: 'Tenant details', hint: 'Identity, owner, plan' },
  { title: 'Contact & address', hint: 'Who we write to' },
  { title: 'Apps & modules', hint: 'What they can open' },
  { title: 'Admin users', hint: 'At least one admin' },
  { title: 'Review', hint: 'Last look before it goes live' },
]
const HEADINGS: [string, string][] = [
  ['Who they are', 'Name, slug, code and owner are all it takes to create the tenant. Once they are in you can create it straight away and fill in the rest later.'],
  ['How we reach them', 'Invites and billing notices go to the contact e-mail. Everything here is optional.'],
  ['What they can open', 'Control Centre and Calendar come with every tenant. Switch on the other apps they pay for, down to the module.'],
  ['Who runs it', 'A tenant needs at least one admin. The owner is the first; add anyone else who should be invited when the tenant is created.'],
  ['Check it over', 'Everything you have set, in one place. The owner’s sign-in link is created the moment you do.'],
]
const appLabel = (a: AppName) => a

// The API still speaks the seeded classification codes (00007_seed_reference.sql); the design speaks
// organisation / party types. Closest mapping until the SRS reconciles the two vocabularies.
const PARTY_TYPE: Record<OrgType, string> = {
  Government: 'government',
  'Local government': 'government',
  'Public company': 'public-company',
  'Private company': 'private-company',
  NGO: 'ngo',
  International: 'ngo',
}
const INSTITUTION_TYPE: Record<EntityType, string> = {
  Ministry: 'ministry',
  'Statutory body': 'business',
  Council: 'council',
  Hospital: 'hospital',
  School: 'school',
  Education: 'university',
  Transport: 'business',
  Telecom: 'business',
  Other: 'business',
}

type DraftAdmin = { name: string; idNo: string; email: string; nat: Nationality }

type Form = {
  name: string; slug: string; code: string; regNo: string; regDate: string; orgType: OrgType; entityType: EntityType
  ownerName: string; ownerEmail: string; tree: 'Standalone' | 'Child'; parent: string; plan: PlanName; seats: number
  addr: string; country: string; district: string; city: string; postal: string; sameAsReg: boolean; contact: string; email: string
  apps: TenantApps; nat: Nationality; aName: string; aId: string; aEmail: string; admins: DraftAdmin[]
}

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40)
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const today = () => fmt(new Date())
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

/**
 * Add a tenant in a large stepped dialog (the New employee pattern): a Stepper rail on the left,
 * one step body on the right. A step can only be moved past once complete; later steps stay locked
 * until then. "Create tenant" calls the real provisioning API and is offered from every step as soon as the required
 * details (name, slug, code, owner) are in: the owner is the required admin and Control Centre +
 * Calendar are included, so nothing on a later step can block it. Everything the API does not take
 * yet (plan, apps, geography, parent, extra admins) is saved to the fixture profile afterwards.
 */
export function AddTenantWizard({ onClose, onProvisioned }: { onClose: () => void; onProvisioned: (p: Provisioned) => void }) {
  const toast = useToast()
  const user = useCurrentUser()
  const create = useCreateTenant()
  const { create: saveProfile } = useTenantProfileActions()
  const { tenants } = useTenantDirectory()
  const apiList = useTenants()
  const plans = usePlans()
  const catalog = useAppCatalog()
  const core = useCoreApps()
  const orgTypes = useOrgTypes()
  const entityTypes = useEntityTypes()
  const countries = useActiveCountries()

  const [step, setStep] = useState(0)
  const [slugTouched, setSlugTouched] = useState(false)
  const [f, setF] = useState<Form>(() => ({
    name: '', slug: '', code: '', regNo: '', regDate: '', orgType: 'Government', entityType: 'Ministry',
    ownerName: '', ownerEmail: '', tree: 'Standalone', parent: '', plan: 'Basic', seats: 120,
    addr: '', country: 'Maldives', district: 'Kaafu', city: 'Malé City', postal: '', sameAsReg: true, contact: '', email: '',
    apps: Object.fromEntries(core.map((a) => [a, catalog.find((c) => c.name === a)?.modules ?? []])),
    nat: 'Maldivian', aName: '', aId: '', aEmail: '', admins: [],
  }))
  const set = <TKey extends keyof Form>(k: TKey, v: Form[TKey]) => setF((prev) => ({ ...prev, [k]: v }))

  const districts = useTopLevelGeographies(f.country)
  const cities = useChildGeographies(f.district)

  const regDupe = f.regNo.trim() ? tenants.find((t) => t.regNo.toLowerCase() === f.regNo.trim().toLowerCase()) : undefined
  const slugDupe = f.slug.trim() ? tenants.find((t) => t.slug === f.slug.trim()) : undefined
  const parentOptions = tenants.filter((t) => !t.parentSlug && t.directoryStatus !== 'archived')
  const hasOwner = !!(f.ownerName.trim() && isEmail(f.ownerEmail))
  const adminCount = (hasOwner ? 1 : 0) + f.admins.length

  /** What still stops step `i` from being complete; empty = passable. */
  const missing = (i: number): string[] => {
    const out: string[] = []
    if (i === 0) {
      if (!f.name.trim()) out.push('a name')
      if (!f.slug.trim()) out.push('a slug')
      else if (slugDupe) out.push(`a slug not already used by ${slugDupe.abbr}`)
      if (!f.code.trim()) out.push('a code')
      if (regDupe) out.push(`a reg no. not already used by ${regDupe.abbr}`)
      if (!f.ownerName.trim()) out.push('the owner name')
      if (!isEmail(f.ownerEmail)) out.push('a valid owner email')
      if (f.tree === 'Child' && !f.parent) out.push('a parent tenant')
    }
    if (i === 1 && f.email.trim() && !isEmail(f.email)) out.push('a valid contact e-mail')
    if (i === 3 && adminCount === 0) out.push('at least one admin user')
    return out
  }
  const complete = (i: number) => missing(i).length === 0
  const ready = STEPS.every((_, i) => complete(i))

  /** Toasts what step `i` is missing and returns true when it cannot be passed. */
  const blocked = (i: number) => {
    const m = missing(i)
    if (!m.length) return false
    toast(`${STEPS[i].title} still needs ${m.join(', ')}.`, { ok: false })
    return true
  }
  /** Back is always allowed; forward only past complete steps (lands on the first incomplete one). */
  const go = (n: number) => {
    if (n > step) {
      for (let i = 0; i < n; i++) if (blocked(i)) return setStep(i)
    }
    setStep(n)
  }

  const toggleApp = (app: AppName) => {
    if (core.includes(app)) return
    const apps = { ...f.apps }
    if (apps[app]) delete apps[app]
    else apps[app] = (catalog.find((a) => a.name === app)?.modules ?? []).slice(0, 1)
    set('apps', apps)
  }
  const toggleModule = (app: AppName, mod: string) => {
    const list = f.apps[app]
    if (!list || core.includes(app)) return
    const next = list.includes(mod) ? (list.length > 1 ? list.filter((m) => m !== mod) : list) : [...list, mod]
    set('apps', { ...f.apps, [app]: next })
  }

  const addAdmin = () => {
    const email = f.aEmail.trim().toLowerCase()
    if (!f.aName.trim() || !isEmail(email)) return toast('A name and a valid e-mail are the minimum for an admin user.', { ok: false })
    if (email === f.ownerEmail.trim().toLowerCase() || f.admins.some((a) => a.email.toLowerCase() === email)) return toast('That e-mail is already on the list.', { ok: false })
    setF((p) => ({
      ...p,
      admins: [...p.admins, { name: p.aName.trim(), idNo: p.aId.trim() || (p.nat === 'Maldivian' ? 'ID pending' : 'Passport pending'), email: p.aEmail.trim(), nat: p.nat }],
      aName: '', aId: '', aEmail: '',
    }))
    toast('Added. The invite sends when you create the tenant.')
  }

  const profileFrom = (slug: string, name: string, status: TenantProfile['status']): TenantProfile => {
    const admins: TenantAdmin[] = [
      ...(f.ownerName.trim() ? [{ name: f.ownerName.trim(), idNo: 'Owner', email: f.ownerEmail.trim(), invite: 'Invited' as const, last: 'Invited just now' }] : []),
      ...f.admins.map((a, i) => ({ name: a.name, idNo: a.idNo.endsWith('pending') ? `${a.idNo} ${i + 1}` : a.idNo, email: a.email, invite: 'Invited' as const, last: 'Invited just now' })),
    ]
    const apps: TenantApps = { ...f.apps }
    for (const a of core) apps[a] = apps[a] ?? catalog.find((c) => c.name === a)?.modules ?? []
    return {
      slug, name, abbr: (f.code.trim() || name.slice(0, 4)).toUpperCase(), regNo: f.regNo.trim() || '—',
      orgType: f.orgType, entityType: f.entityType,
      parentSlug: f.tree === 'Child' && f.parent ? f.parent : null,
      plan: f.plan, seatsUsed: 0, seatLimit: f.seats, status,
      activeFrom: status === 'Active' ? today() : '—',
      contact: f.contact.trim() || '—', email: f.email.trim() || f.ownerEmail.trim() || '—',
      country: f.country, district: f.city && f.city !== '—' ? f.city : f.district,
      addr: f.addr.trim() || '—', mail: f.sameAsReg ? 'Same as registered address' : '—',
      apps, admins,
      activity: [{ when: today(), what: status === 'Draft' ? 'Saved as draft' : 'Tenant created and activated', who: user.name }],
    }
  }

  const create_ = () => {
    const bad = STEPS.findIndex((_, i) => !complete(i))
    if (bad >= 0) {
      blocked(bad)
      return setStep(bad)
    }
    const input: CreateTenantInput = {
      name: f.name.trim(),
      slug: f.slug.trim(),
      code: f.code.trim(),
      country: countries.find((c) => c.name === f.country)?.code ?? 'MV',
      party_type_code: PARTY_TYPE[f.orgType],
      institution_type_code: INSTITUTION_TYPE[f.entityType],
      owner_email: f.ownerEmail.trim(),
      owner_name: f.ownerName.trim(),
    }
    create.mutate(input, {
      onSuccess: async (res) => {
        saveProfile(profileFrom(res.tenant.slug, res.tenant.name, 'Active'))
        // Wait for the list to hold the new tenant, so its row carries the API id (and the API
        // lifecycle buttons) the moment the list shows it.
        await apiList.refetch()
        toast(`${res.tenant.name} created`)
        onProvisioned({ name: res.tenant.name, recoveryLink: res.recovery_link })
      },
      onError: (e) => toast(e instanceof Error ? e.message : 'Could not create tenant', { ok: false }),
    })
  }

  const saveDraft = () => {
    const name = f.name.trim() || 'Untitled tenant'
    const slug = f.slug.trim() || slugify(name) || `draft-${Date.now()}`
    saveProfile(profileFrom(slug, name, 'Draft'))
    toast('Draft saved. It stays in the tenant list marked Draft.')
    onClose()
  }

  const optional = catalog.filter((a) => !core.includes(a.name))
  const extraApps = optional.filter((a) => f.apps[a.name]).length
  const last = STEPS.length - 1
  const notes = [
    ready ? 'Ready to create. The other steps are optional.' : 'Name, slug, code and owner are all it needs.',
    'Optional. Left blank, notices go to the owner.',
    `Control Centre and Calendar are included${extraApps ? ` · ${extraApps} more ${extraApps === 1 ? 'app' : 'apps'}` : ''}.`,
    adminCount ? `${adminCount} ${adminCount === 1 ? 'admin' : 'admins'} will be invited when you create it.` : 'Add at least one admin to continue.',
    'Nothing is created until you press the button.',
  ]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[940px]" showCloseButton>
        <StepperLayout rail={<Stepper title="New tenant" steps={STEPS} current={step} complete={complete} onStep={go} />}>
          <StepHeading title={HEADINGS[step][0]} lede={HEADINGS[step][1]} />

          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="t-name" label="Name" className="sm:col-span-2">
                <input
                  id="t-name"
                  autoFocus
                  value={f.name}
                  placeholder="e.g. National Centre for Information Technology"
                  className={fieldClass}
                  onChange={(e) => {
                    const name = e.target.value
                    setF((p) => ({ ...p, name, slug: slugTouched ? p.slug : slugify(name) }))
                  }}
                />
              </Field>
              <Field id="t-slug" label="Slug" hint={slugDupe ? `Already used by ${slugDupe.abbr}.` : 'The tenant’s web address: slug.bool.mv'} warn={!!slugDupe}>
                <input id="t-slug" value={f.slug} placeholder="ncit" className={cn(fieldClass, 'font-mono text-compact')} onChange={(e) => (setSlugTouched(true), set('slug', e.target.value))} />
              </Field>
              <Field id="t-code" label="Code" hint="Short name shown across the platform, e.g. NCIT.">
                <input id="t-code" value={f.code} placeholder="NCIT" className={fieldClass} onChange={(e) => set('code', e.target.value)} />
              </Field>
              <Field id="t-owner-name" label="Owner name" hint="The first admin. They get a one-time link to set a password.">
                <input id="t-owner-name" value={f.ownerName} placeholder="Fathimath Mohamed" className={fieldClass} onChange={(e) => set('ownerName', e.target.value)} />
              </Field>
              <Field id="t-owner-email" label="Owner email" hint={f.ownerEmail.trim() && !isEmail(f.ownerEmail) ? 'That doesn’t look like an e-mail address.' : undefined} warn>
                <input id="t-owner-email" type="email" value={f.ownerEmail} placeholder="name@tenant.gov.mv" className={fieldClass} onChange={(e) => set('ownerEmail', e.target.value)} />
              </Field>

              <div className="grid gap-4 border-t border-divider pt-[18px] sm:col-span-2 sm:grid-cols-2">
                <Field id="t-reg" label="Reg no." hint={regDupe ? `Already used by ${regDupe.abbr}. Registration numbers must be unique.` : undefined} warn>
                  <input id="t-reg" value={f.regNo} placeholder="CO123456" className={fieldClass} onChange={(e) => set('regNo', e.target.value)} />
                </Field>
                <Field id="t-regdate" label="Reg date">
                  <DatePicker id="t-regdate" value={f.regDate} onChange={(iso) => set('regDate', iso)} placeholder="Pick the registration date" />
                </Field>
                <Field id="t-org" label="Organization type">
                  <NativeSelect id="t-org" value={f.orgType} onChange={(e) => set('orgType', e.target.value as OrgType)}>
                    {orgTypes.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field id="t-party" label="Party type">
                  <NativeSelect id="t-party" value={f.entityType} onChange={(e) => set('entityType', e.target.value as EntityType)}>
                    {entityTypes.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <div className="border-t border-divider pt-[18px] sm:col-span-2">
                <div className="mb-2 text-overline text-faint">Place in the tenant tree</div>
                <div role="radiogroup" aria-label="Place in the tenant tree" className="grid gap-2.5 sm:grid-cols-2">
                  {(
                    [
                      ['Standalone', 'Standalone or parent', 'Stands on its own. Other tenants can later be added under it.'],
                      ['Child', 'Child of another tenant', 'Rolls up to a parent for plan and reporting.'],
                    ] as const
                  ).map(([k, label, sub]) => (
                    <PickCard key={k} on={f.tree === k} onClick={() => set('tree', k)}>
                      <Radio on={f.tree === k} />
                      <span className="min-w-0">
                        <span className="block text-ui-sm font-bold text-foreground">{label}</span>
                        <span className="mt-0.5 block text-caption leading-[1.45] text-faint">{sub}</span>
                      </span>
                    </PickCard>
                  ))}
                </div>
                {f.tree === 'Child' && (
                  <Field id="t-parent" label="Parent tenant" className="mt-3.5 max-w-[420px]" hint="A child keeps its own admins and data, but rolls up to the parent.">
                    <NativeSelect id="t-parent" value={f.parent} onChange={(e) => set('parent', e.target.value)}>
                      <option value="">Pick a parent</option>
                      {parentOptions.map((t) => (
                        <option key={t.slug} value={t.slug}>
                          {t.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
              </div>

              <div className="border-t border-divider pt-[18px] sm:col-span-2">
                <div className="mb-2 text-overline text-faint">Plan</div>
                <div role="radiogroup" aria-label="Plan" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
                  {plans.map((p) => (
                    <PickCard key={p.name} on={f.plan === p.name} onClick={() => setF((prev) => ({ ...prev, plan: p.name, seats: p.seats }))} block>
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-ui-sm font-black text-foreground">{p.name}</span>
                        <Radio on={f.plan === p.name} />
                      </span>
                      <span className="mt-2 block text-caption font-bold text-body">{p.seats} seats included</span>
                      <span className="mt-0.5 block text-caption leading-[1.45] text-faint">{p.note}</span>
                    </PickCard>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="t-contact" label="Contact number">
                <input id="t-contact" value={f.contact} placeholder="3324568" inputMode="tel" className={fieldClass} onChange={(e) => set('contact', e.target.value)} />
              </Field>
              <Field
                id="t-email"
                label="E-mail address"
                hint={f.email.trim() && !isEmail(f.email) ? 'That doesn’t look like an e-mail address.' : 'Invites and billing notices go here.'}
                warn={!!f.email.trim() && !isEmail(f.email)}
              >
                <input id="t-email" type="email" value={f.email} placeholder="admin@tenant.gov.mv" className={fieldClass} onChange={(e) => set('email', e.target.value)} />
              </Field>

              <div className="grid gap-4 border-t border-divider pt-[18px] sm:col-span-2 sm:grid-cols-2">
                <div className="text-overline text-faint sm:col-span-2">Address</div>
                <Field id="t-country" label="Country">
                  <NativeSelect id="t-country" value={f.country} onChange={(e) => setF((p) => ({ ...p, country: e.target.value, district: '', city: '—' }))}>
                    {countries.map((c) => (
                      <option key={c.code}>{c.name}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field id="t-district" label="Atoll / State">
                  <NativeSelect id="t-district" value={f.district} onChange={(e) => setF((p) => ({ ...p, district: e.target.value, city: '—' }))}>
                    <option value="">—</option>
                    {districts.map((g) => (
                      <option key={g.name}>{g.name}</option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field id="t-city" label="Island / City">
                  <NativeSelect id="t-city" value={f.city} onChange={(e) => set('city', e.target.value)}>
                    {cities.map((g) => (
                      <option key={g.name}>{g.name}</option>
                    ))}
                    <option>—</option>
                  </NativeSelect>
                </Field>
                <Field id="t-postal" label="Postal code">
                  <input id="t-postal" value={f.postal} placeholder="20026" className={fieldClass} onChange={(e) => set('postal', e.target.value)} />
                </Field>
                <Field id="t-addr" label="Address" className="sm:col-span-2">
                  <input id="t-addr" value={f.addr} placeholder="NCIT, Kalaafaanu Hingun" className={fieldClass} onChange={(e) => set('addr', e.target.value)} />
                </Field>
                <label className="flex cursor-pointer items-center gap-2.5 text-compact text-body sm:col-span-2">
                  <Checkbox checked={f.sameAsReg} onCheckedChange={(v) => set('sameAsReg', v)} />
                  Mailing address is the same as this address
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-2.5">
              <div className="text-overline text-faint">Included with every tenant</div>
              {catalog
                .filter((a) => core.includes(a.name))
                .map((a) => (
                  <div key={a.name} className="flex items-center gap-3 rounded-[13px] bg-surface-band px-4 py-3.5">
                    <Lock className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-ui-sm font-black text-foreground">{appLabel(a.name)}</span>
                      <span className="mt-0.5 block text-caption text-faint">{a.name === 'Control Centre' ? 'The tenant’s own admin: users, roles, units, sites and settings' : a.note}</span>
                    </span>
                    <Badge variant="success" size="sm">
                      Included
                    </Badge>
                  </div>
                ))}

              <div className="mt-3 text-overline text-faint">Optional apps</div>
              {optional.map((a) => {
                const mods = f.apps[a.name]
                const on = !!mods
                return (
                  <div key={a.name} className={cn('rounded-[13px] bg-card p-3.5', on ? 'shadow-[inset_0_0_0_1px_var(--sage)]' : 'shadow-[inset_0_0_0_1px_var(--input)]')}>
                    <label className="flex cursor-pointer items-center gap-3">
                      <Checkbox checked={on} onCheckedChange={() => toggleApp(a.name)} aria-label={appLabel(a.name)} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-ui-sm font-black text-foreground">{appLabel(a.name)}</span>
                        <span className="mt-0.5 block text-caption text-faint">{a.note}</span>
                      </span>
                      <Badge variant={on ? 'secondary' : 'neutral'} size="sm">
                        {on ? `${mods.length} of ${a.modules.length} modules` : 'Off'}
                      </Badge>
                    </label>
                    {on && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[31px]">
                        {a.modules.map((m) => {
                          const mon = mods.includes(m)
                          return (
                            <button
                              key={m}
                              type="button"
                              aria-pressed={mon}
                              onClick={() => toggleModule(a.name, m)}
                              className={cn(
                                'h-[30px] rounded-full px-3 text-fine font-bold outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring',
                                mon ? 'bg-sage text-sage-foreground' : 'text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-surface-soft'
                              )}
                            >
                              {m}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <div className="text-overline text-faint">Admins · at least one required</div>
                <span className="text-caption text-faint">{adminCount} on the list</span>
              </div>
              <div className="overflow-clip rounded-[13px] border border-border bg-surface-band">
                {hasOwner ? (
                  <AdminRow name={f.ownerName.trim()} sub={`${f.ownerEmail.trim()} · gets the sign-in link when you create it`} tag="Owner · counts as admin" />
                ) : (
                  <div className="flex items-center justify-between gap-3 border-b border-divider px-4 py-3 last:border-b-0">
                    <span className="text-compact text-body">No owner yet. The owner is the tenant’s first admin.</span>
                    <Button variant="link" size="xs" onClick={() => setStep(0)}>
                      Add the owner
                    </Button>
                  </div>
                )}
                {f.admins.map((a, i) => (
                  <AdminRow key={`${a.email}-${i}`} name={a.name} sub={`${a.idNo} · ${a.email} · invite sends when you create it`} onRemove={() => set('admins', f.admins.filter((_, j) => j !== i))} />
                ))}
              </div>

              <div className="mt-5 mb-2 text-overline text-faint">Add another admin</div>
              <div className="rounded-[13px] bg-card p-4 shadow-[inset_0_0_0_1px_var(--input)]">
                <Segmented aria-label="Nationality" className="mb-4">
                  <SegmentedItem active={f.nat === 'Maldivian'} onClick={() => set('nat', 'Maldivian')}>
                    Maldivian — national ID
                  </SegmentedItem>
                  <SegmentedItem active={f.nat === 'Expatriate'} onClick={() => set('nat', 'Expatriate')}>
                    Expatriate — passport
                  </SegmentedItem>
                </Segmented>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="a-name" label="Full name">
                    <input id="a-name" value={f.aName} placeholder="Aishath Leena" className={fieldClass} onChange={(e) => set('aName', e.target.value)} />
                  </Field>
                  <Field id="a-id" label={f.nat === 'Maldivian' ? 'ID number' : 'Passport number'} hint={f.nat === 'Expatriate' ? 'Expatriate admins also need a work permit number before first sign-in.' : undefined}>
                    <input id="a-id" value={f.aId} placeholder={f.nat === 'Maldivian' ? 'A123566' : 'P-8823441'} className={fieldClass} onChange={(e) => set('aId', e.target.value)} />
                  </Field>
                  <Field id="a-email" label="E-mail address" className="sm:col-span-2">
                    <input id="a-email" type="email" value={f.aEmail} placeholder="name@tenant.gov.mv" className={fieldClass} onChange={(e) => set('aEmail', e.target.value)} />
                  </Field>
                </div>
                <Button variant="outline" className="mt-4" onClick={addAdmin}>
                  Add this person
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-2.5">
              <ReviewCard
                title="Tenant details"
                onEdit={() => setStep(0)}
                lines={[
                  ['Name', f.name.trim() || 'Not set'],
                  ['Slug · code', `${f.slug.trim() || '—'} · ${f.code.trim() || '—'}`],
                  ['Owner', hasOwner ? `${f.ownerName.trim()} · ${f.ownerEmail.trim()}` : 'Not set'],
                  ['Reg no.', f.regNo.trim() ? `${f.regNo.trim()}${f.regDate ? ` · ${fmt(new Date(`${f.regDate}T00:00`))}` : ''}` : 'Not set'],
                  ['Type', `${f.orgType} · ${f.entityType}`],
                  ['Tenant tree', f.tree === 'Child' ? `Child of ${tenants.find((t) => t.slug === f.parent)?.name ?? 'not picked'}` : 'Standalone / can take children'],
                  ['Plan', `${f.plan} · ${f.seats} seats`],
                ]}
              />
              <ReviewCard
                title="Contact & address"
                onEdit={() => setStep(1)}
                lines={[
                  ['Contact number', f.contact.trim() || 'Not set'],
                  ['E-mail', f.email.trim() || `None, notices go to ${f.ownerEmail.trim() || 'the owner'}`],
                  ['Address', [f.addr.trim(), f.city !== '—' ? f.city : '', f.district, f.country, f.postal.trim()].filter(Boolean).join(', ') || 'Not set'],
                  ['Mailing address', f.sameAsReg ? 'Same as address' : 'Separate, not yet filled'],
                ]}
              />
              <ReviewCard
                title="Apps & modules"
                onEdit={() => setStep(2)}
                lines={catalog
                  .filter((a) => f.apps[a.name] || core.includes(a.name))
                  .map((a) => [appLabel(a.name), core.includes(a.name) ? 'Included' : (f.apps[a.name] ?? []).join(', ')] as [string, string])}
              />
              <ReviewCard
                title="Admin users"
                onEdit={() => setStep(3)}
                lines={[
                  ...(hasOwner ? [[f.ownerName.trim(), `Owner · ${f.ownerEmail.trim()}`] as [string, string]] : []),
                  ...f.admins.map((a) => [a.name, `${a.idNo} · ${a.email}`] as [string, string]),
                ]}
              />
            </div>
          )}

          <StepperFooter note={notes[step]}>
            <Button variant="ghost" onClick={saveDraft}>
              Save as draft
            </Button>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </Button>
            )}
            {step < last && (
              <Button variant={ready ? 'outline' : 'default'} onClick={() => go(step + 1)}>
                {step === last - 1 ? 'Review' : 'Continue'}
              </Button>
            )}
            {(ready || step === last) && (
              <Button onClick={create_} disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create tenant'}
              </Button>
            )}
          </StepperFooter>
        </StepperLayout>
      </DialogContent>
    </Dialog>
  )
}

function PickCard({ on, onClick, block, children }: { on: boolean; onClick: () => void; block?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'rounded-[13px] bg-card px-[15px] py-[13px] text-left outline-none transition-[box-shadow] duration-instant focus-visible:ring-2 focus-visible:ring-ring',
        block ? 'block' : 'flex items-start gap-[11px]',
        on ? 'shadow-[inset_0_0_0_1.5px_var(--sage)]' : 'shadow-[inset_0_0_0_1px_var(--input)] hover:bg-surface-soft'
      )}
    >
      {children}
    </button>
  )
}

function Radio({ on }: { on: boolean }) {
  return <span aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0 rounded-full transition-[box-shadow] duration-instant', on ? 'shadow-[inset_0_0_0_5px_var(--sage)]' : 'shadow-[inset_0_0_0_1px_var(--input)]')} />
}

function AdminRow({ name, sub, tag, onRemove }: { name: string; sub: string; tag?: string; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-divider px-4 py-3 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block text-ui-sm font-bold text-foreground">{name}</span>
        <span className="mt-0.5 block truncate text-caption text-faint">{sub}</span>
      </span>
      {tag && (
        <Badge variant="success" size="sm">
          {tag}
        </Badge>
      )}
      {onRemove && (
        <Button variant="link" size="xs" onClick={onRemove}>
          Remove
        </Button>
      )}
    </div>
  )
}
