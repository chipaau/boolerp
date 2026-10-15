import { useState } from 'react'
import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { referenceQueries } from '@workspace/reference/api'
import { CountrySelect } from '@workspace/reference/country-select'
import { InstitutionTypesField } from '@workspace/reference/institution-types-field'
import type { InstitutionTypesValue } from '@workspace/reference/institution-types-field'
import { LegalFormSelect } from '@workspace/reference/legal-form-select'
import { TimezoneSelect } from '@workspace/reference/timezone-select'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { ComboboxField } from '@workspace/ui/components/combobox'
import { DatePicker } from '@workspace/ui/components/date-picker'
import { Dialog, DialogContent } from '@workspace/ui/components/dialog'
import { SelectField } from '@workspace/ui/components/select'
import { Segmented, SegmentedItem } from '@workspace/ui/components/segmented'
import { Stepper, StepperFooter, StepperLayout } from '@workspace/ui/components/stepper'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { Field, ReviewCard, StepHeading, fieldClass } from '@/components/form-field'
import { useCurrentUser } from '@/components/layout/user-context'
import { useActiveCountries, useChildGeographies, useTopLevelGeographies } from '@/features/geographies/queries'
import { tenantQueries } from './api'
import { useAppCatalog, useCoreApps, useTenantDirectory, useTenantProfileActions } from './queries'
import type { AppName, Nationality, TenantAdmin, TenantApps, TenantProfile } from './types'

/** What the list shows after a successful provision: the one-time recovery link for the owner. */
/** What the list shows after the prototype's wizard finishes. Fixtures only (F2f): the activation
 *  link is a placeholder, since nothing is provisioned. Creating a tenant for real is F3. */
export type Provisioned = { name: string; recoveryLink: string }

const STEPS = [
  { title: 'Tenant details', hint: 'Who they are, in law' },
  { title: 'Address', hint: 'Where they are' },
  { title: 'Apps & modules', hint: 'What they can open' },
  { title: 'Admin users', hint: 'At least one admin' },
  { title: 'Review', hint: 'Last look before it goes live' },
]
const HEADINGS: [string, string][] = [
  ['Who they are', 'What the tenant is called, where it is registered, and what it does. This step creates the tenant; the rest can be filled in later on its details page.'],
  ['Where they are', 'The registered address. Everything here is optional.'],
  ['What they can open', 'Control Centre and Calendar come with every tenant. Switch on the other apps they pay for, down to the module.'],
  ['Who runs it', 'A tenant needs at least one owner before it can be activated. Add the people who should be invited.'],
  ['Check it over', 'Everything you have set, in one place.'],
]
const appLabel = (a: AppName) => a

type DraftAdmin = { name: string; idNo: string; email: string; nat: Nationality }

type Form = {
  // Step 1, the request that creates the tenant (C197). `country` is the tenant's (an ISO code);
  // `addrCountry` is the address step's, still the prototype's geography fixtures.
  name: string; slug: string; code: string; country: string | null; legalFormId: string | null; identityDocument: string | null
  identityNumber: string; registeredOn: string; taxNumber: string; timezone: string | null; types: InstitutionTypesValue
  email: string; phone: string; tree: 'Standalone' | 'Child'; parentId: string | null
  addr: string; addrCountry: string; district: string; city: string; postal: string; sameAsReg: boolean
  apps: TenantApps; nat: Nationality; aName: string; aId: string; aEmail: string; admins: DraftAdmin[]
}

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40)
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const today = () => fmt(new Date())
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
/** The API's phone format: + and 6 to 15 digits (E.164). */
const isPhone = (s: string) => /^\+[0-9]{6,15}$/.test(s.replace(/[\s-]/g, ''))

/**
 * Add a tenant in a large stepped dialog (the New employee pattern): a Stepper rail on the left,
 * one step body on the right. A step can only be moved past once complete; later steps stay locked
 * until then. Step 1 is the request that creates the tenant in provisioning (C197): name, slug,
 * code, country, legal form (and the number of the document it names), time zone, and institution
 * types are required; the reference lists come from the API (C199) through @workspace/reference.
 * "Create tenant" is offered as soon as step 1 is complete: owners are needed to activate a tenant
 * (C198), not to create it. Until POST /api/v1/tenants exists it saves nothing in preview, and only
 * the prototype's fixture profile otherwise.
 */
export function AddTenantWizard({
  onClose,
  onProvisioned,
  preview = false,
}: {
  onClose: () => void
  onProvisioned: (p: Provisioned) => void
  /**
   * Opened from the API-backed list before creating exists (F3): the form works, but "Create tenant"
   * and "Save as draft" save nothing, not even to the prototype's fixtures, and say so.
   */
  preview?: boolean
}) {
  const toast = useToast()
  const user = useCurrentUser()
  const { create: saveProfile } = useTenantProfileActions()
  const { tenants } = useTenantDirectory()
  const catalog = useAppCatalog()
  const core = useCoreApps()
  const countries = useActiveCountries()

  const [step, setStep] = useState(0)
  const [slugTouched, setSlugTouched] = useState(false)
  const [f, setF] = useState<Form>(() => ({
    name: '', slug: '', code: '', country: null, legalFormId: null, identityDocument: null,
    identityNumber: '', registeredOn: '', taxNumber: '', timezone: null, types: { codes: [], primary: null },
    email: '', phone: '', tree: 'Standalone', parentId: null,
    addr: '', addrCountry: 'Maldives', district: 'Kaafu', city: 'Malé City', postal: '', sameAsReg: true,
    apps: Object.fromEntries(core.map((a) => [a, catalog.find((c) => c.name === a)?.modules ?? []])),
    nat: 'Maldivian', aName: '', aId: '', aEmail: '', admins: [],
  }))
  const set = <TKey extends keyof Form>(k: TKey, v: Form[TKey]) => setF((prev) => ({ ...prev, [k]: v }))
  // The pickers' lists, from the same cache, to name the choices on the review step.
  const refCountries = useQuery(referenceQueries.countries()).data
  const legalForms = useQuery(referenceQueries.legalForms(f.country ?? '')).data
  const institutionTypes = useQuery(referenceQueries.institutionTypes()).data
  const countryName = (code: string | null) => (code ? (refCountries?.find((c) => c.code === code)?.name ?? code) : undefined)
  const legalFormName = legalForms?.find((l) => l.id === f.legalFormId)?.name
  const typeName = (code: string) => institutionTypes?.find((t) => t.code === code)?.name ?? code

  const districts = useTopLevelGeographies(f.addrCountry)
  const cities = useChildGeographies(f.district)

  const slugDupe = f.slug.trim() ? tenants.find((t) => t.slug === f.slug.trim()) : undefined
  // A parent is one of the API's tenants, shown by name and chosen by id (C197's parentId).
  const apiTenants = useQuery(tenantQueries.list({ page: 1, pageSize: 100, sort: 'name' })).data?.items
  const parentOptions = (apiTenants ?? [])
    .filter((t) => t.status !== 'archived')
    .map((t) => ({ value: t.id, label: t.name, detail: t.code, keywords: `${t.code} ${t.slug}` }))
  const parentName = apiTenants?.find((t) => t.id === f.parentId)?.name
  const adminCount = f.admins.length

  /** What still stops step `i` from being complete; empty = passable. */
  const missing = (i: number): string[] => {
    const out: string[] = []
    if (i === 0) {
      if (!f.name.trim()) out.push('a name')
      if (!f.slug.trim()) out.push('a slug')
      else if (slugDupe) out.push(`a slug not already used by ${slugDupe.abbr}`)
      if (!f.code.trim()) out.push('a code')
      if (!f.country) out.push('the country')
      if (!f.legalFormId) out.push('the legal form')
      else if (f.identityDocument && !f.identityNumber.trim()) out.push(`the ${f.identityDocument.toLowerCase()}`)
      if (!f.timezone) out.push('the time zone')
      if (!f.types.codes.length) out.push('an institution type')
      if (f.email.trim() && !isEmail(f.email)) out.push('a valid e-mail')
      if (f.phone.trim() && !isPhone(f.phone)) out.push('a phone number in international form')
      if (f.tree === 'Child' && !f.parentId) out.push('a parent tenant')
    }
    return out
  }
  const complete = (i: number) => missing(i).length === 0
  // Creating needs step 1 only (C197); the later steps can be finished on the details page.
  const ready = complete(0)

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
    if (f.admins.some((a) => a.email.toLowerCase() === email)) return toast('That e-mail is already on the list.', { ok: false })
    setF((p) => ({
      ...p,
      admins: [...p.admins, { name: p.aName.trim(), idNo: p.aId.trim() || (p.nat === 'Maldivian' ? 'ID pending' : 'Passport pending'), email: p.aEmail.trim(), nat: p.nat }],
      aName: '', aId: '', aEmail: '',
    }))
    toast('Added. The invite sends when you create the tenant.')
  }

  const profileFrom = (slug: string, name: string, status: TenantProfile['status']): TenantProfile => {
    const admins: TenantAdmin[] = [
      ...f.admins.map((a, i) => ({ name: a.name, idNo: a.idNo.endsWith('pending') ? `${a.idNo} ${i + 1}` : a.idNo, email: a.email, invite: 'Invited' as const, last: 'Invited just now' })),
    ]
    const apps: TenantApps = { ...f.apps }
    for (const a of core) apps[a] = apps[a] ?? catalog.find((c) => c.name === a)?.modules ?? []
    return {
      slug, name, abbr: (f.code.trim() || name.slice(0, 4)).toUpperCase(), regNo: f.identityNumber.trim() || '—',
      orgType: 'Not set', entityType: 'Not set',
      parentSlug: null, // the parent is an API tenant, not one of the prototype's fixtures
      plan: 'Basic', seatsUsed: 0, seatLimit: 0, status,
      activeFrom: status === 'Active' ? today() : '—',
      contact: f.phone.trim() || '—', email: f.email.trim() || '—',
      country: f.addrCountry, district: f.city && f.city !== '—' ? f.city : f.district,
      addr: f.addr.trim() || '—', mail: f.sameAsReg ? 'Same as registered address' : '—',
      apps, admins,
      activity: [{ when: today(), what: status === 'Draft' ? 'Saved as draft' : 'Tenant created and activated', who: user.name }],
    }
  }

  const create_ = () => {
    if (blocked(0)) return setStep(0)
    const input = { name: f.name.trim(), slug: f.slug.trim() }
    if (preview) {
      toast('Preview only: nothing was saved. Creating tenants comes next (F3).', { ok: false })
      return onClose()
    }
    // Fixtures only (F2f): this used to POST /api/v1/tenants. Creating a tenant for real — the
    // endpoint, the form, and the API's field errors on it — is F3, in the new list.
    saveProfile(profileFrom(input.slug, input.name, 'Active'))
    toast(`${input.name} created`)
    onProvisioned({ name: input.name, recoveryLink: 'Not provisioned — this is the design prototype.' })
  }

  const saveDraft = () => {
    if (preview) {
      toast('Preview only: nothing was saved. Creating tenants comes next (F3).', { ok: false })
      return onClose()
    }
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
    ready ? 'Ready to create. The other steps are optional.' : 'Creating the tenant needs this step only.',
    'Optional.',
    `Control Centre and Calendar are included${extraApps ? ` · ${extraApps} more ${extraApps === 1 ? 'app' : 'apps'}` : ''}.`,
    adminCount ? `${adminCount} ${adminCount === 1 ? 'person' : 'people'} will be invited.` : 'Optional now; activating the tenant needs an owner.',
    'Nothing is created until you press the button.',
  ]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[940px]" showCloseButton>
        <StepperLayout rail={<Stepper title="New tenant" steps={STEPS} current={step} complete={complete} onStep={go} />}>
          <StepHeading title={HEADINGS[step][0]} lede={HEADINGS[step][1]} />

          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="t-name" label="Name" required className="sm:col-span-2">
                <input
                  id="t-name"
                  required
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
              <Field id="t-slug" label="Slug" required hint={slugDupe ? `Already used by ${slugDupe.abbr}.` : 'The tenant’s web address: slug.bool.mv'} warn={!!slugDupe}>
                <input id="t-slug" required value={f.slug} placeholder="ncit" className={cn(fieldClass, 'font-mono text-compact')} onChange={(e) => (setSlugTouched(true), set('slug', e.target.value))} />
              </Field>
              <Field id="t-code" label="Code" required hint="Short name shown across the platform, e.g. NCIT.">
                <input id="t-code" required value={f.code} placeholder="NCIT" className={fieldClass} onChange={(e) => set('code', e.target.value)} />
              </Field>

              <div className="grid gap-4 border-t border-divider pt-[18px] sm:col-span-2 sm:grid-cols-2">
                <div className="text-overline text-faint sm:col-span-2">Registration</div>
                <Field id="t-country" label="Country" required hint="Where the organisation is registered. Its legal forms follow.">
                  <CountrySelect
                    id="t-country"
                    aria-label="Country"
                    aria-required
                    value={f.country}
                    onValueChange={(country) =>
                      setF((p) => (country === p.country ? p : { ...p, country, legalFormId: null, identityDocument: null, identityNumber: '' }))
                    }
                  />
                </Field>
                <Field id="t-legal-form" label="Legal form" required>
                  <LegalFormSelect
                    id="t-legal-form"
                    aria-label="Legal form"
                    aria-required
                    country={f.country}
                    value={f.legalFormId}
                    onValueChange={(legalFormId, form) =>
                      setF((p) => ({ ...p, legalFormId, identityDocument: form?.identityDocument ?? null, identityNumber: form?.identityDocument ? p.identityNumber : '' }))
                    }
                  />
                </Field>
                {f.identityDocument && (
                  <Field id="t-identity" label={f.identityDocument} required hint="The number on the document this legal form carries. One organisation per number in a country.">
                    <input id="t-identity" required value={f.identityNumber} placeholder="C-1024/2026" className={fieldClass} onChange={(e) => set('identityNumber', e.target.value)} />
                  </Field>
                )}
                <Field id="t-registered" label="Registered on">
                  <DatePicker id="t-registered" value={f.registeredOn} onChange={(iso) => set('registeredOn', iso)} placeholder="Pick the registration date" />
                </Field>
                <Field id="t-tax" label="Tax number" hint="The TIN printed on invoices, if they have one.">
                  <input id="t-tax" value={f.taxNumber} placeholder="1012345GST501" className={fieldClass} onChange={(e) => set('taxNumber', e.target.value)} />
                </Field>
                <Field id="t-timezone" label="Time zone" required hint="Their working days and times are kept in this zone.">
                  <TimezoneSelect id="t-timezone" aria-label="Time zone" aria-required value={f.timezone} onValueChange={(timezone) => set('timezone', timezone)} />
                </Field>
              </div>

              <div className="border-t border-divider pt-[18px] sm:col-span-2">
                <Field id="t-types" label="Institution types" required hint="What they do. Pick one or more; with several, mark the primary one. Their sector follows from it.">
                  <InstitutionTypesField id="t-types" aria-label="Institution types" aria-required value={f.types} onValueChange={(types) => set('types', types)} />
                </Field>
              </div>

              <div className="grid gap-4 border-t border-divider pt-[18px] sm:col-span-2 sm:grid-cols-2">
                <div className="text-overline text-faint sm:col-span-2">Contact · optional</div>
                <Field id="t-email" label="E-mail address" hint={f.email.trim() && !isEmail(f.email) ? 'That doesn’t look like an e-mail address.' : undefined} warn>
                  <input id="t-email" type="email" value={f.email} placeholder="info@tenant.gov.mv" className={fieldClass} onChange={(e) => set('email', e.target.value)} />
                </Field>
                <Field
                  id="t-phone"
                  label="Phone"
                  hint={f.phone.trim() && !isPhone(f.phone) ? 'Write it in international form, starting with + and the country code.' : 'International form, e.g. +960 332 4568.'}
                  warn={!!f.phone.trim() && !isPhone(f.phone)}
                >
                  <input id="t-phone" value={f.phone} placeholder="+960 332 4568" inputMode="tel" className={fieldClass} onChange={(e) => set('phone', e.target.value)} />
                </Field>
              </div>

              <div className="border-t border-divider pt-[18px] sm:col-span-2">
                <div className="mb-2 text-overline text-faint">Place in the tenant tree</div>
                <div role="radiogroup" aria-label="Place in the tenant tree" className="grid gap-2.5 sm:grid-cols-2">
                  {(
                    [
                      ['Standalone', 'Standalone or parent', 'Stands on its own. Other tenants can later be added under it.'],
                      ['Child', 'Child of another tenant', 'Its parent may publish data for it to read.'],
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
                  <Field id="t-parent" label="Parent tenant" required className="mt-3.5 max-w-[420px]" hint="A child keeps its own admins and data; the parent sees nothing inside it.">
                    <ComboboxField
                      id="t-parent"
                      aria-label="Parent tenant"
                      aria-required
                      value={f.parentId}
                      onValueChange={(parentId) => set('parentId', parentId)}
                      options={parentOptions}
                      placeholder={apiTenants ? 'Search tenants by name or code' : 'Loading tenants…'}
                      emptyText="No tenant matches."
                      disabled={!apiTenants}
                    />
                  </Field>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                <Field id="t-addr-country" label="Country">
                  <SelectField
                    id="t-addr-country"
                    aria-label="Address country"
                    value={f.addrCountry}
                    onValueChange={(v) => setF((p) => ({ ...p, addrCountry: v, district: '', city: '—' }))}
                    options={countries.map((c) => c.name)}
                  />
                </Field>
                <Field id="t-district" label="Atoll / State">
                  <SelectField
                    id="t-district"
                    aria-label="Atoll / State"
                    value={f.district}
                    onValueChange={(v) => setF((p) => ({ ...p, district: v, city: '—' }))}
                    options={[{ value: '', label: '—' }, ...districts.map((g) => ({ value: g.name, label: g.name }))]}
                  />
                </Field>
                <Field id="t-city" label="Island / City">
                  <SelectField
                    id="t-city"
                    aria-label="Island / City"
                    value={f.city}
                    onValueChange={(v) => set('city', v)}
                    options={[...cities.map((g) => g.name), '—']}
                  />
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
                <div className="text-overline text-faint">People to invite</div>
                <span className="text-caption text-faint">{adminCount} on the list</span>
              </div>
              <div className="overflow-clip rounded-[13px] border border-border bg-surface-band">
                {!f.admins.length && <div className="px-4 py-3 text-compact text-body">No one yet.</div>}
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
                  <Field id="a-name" label="Full name" required>
                    <input id="a-name" value={f.aName} placeholder="Aishath Leena" className={fieldClass} onChange={(e) => set('aName', e.target.value)} />
                  </Field>
                  <Field id="a-id" label={f.nat === 'Maldivian' ? 'ID number' : 'Passport number'} hint={f.nat === 'Expatriate' ? 'Expatriate admins also need a work permit number before first sign-in.' : undefined}>
                    <input id="a-id" value={f.aId} placeholder={f.nat === 'Maldivian' ? 'A123566' : 'P-8823441'} className={fieldClass} onChange={(e) => set('aId', e.target.value)} />
                  </Field>
                  <Field id="a-email" label="E-mail address" required className="sm:col-span-2">
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
                  ['Country', countryName(f.country) ?? 'Not set'],
                  ['Legal form', legalFormName ?? 'Not set'],
                  ...(f.identityDocument ? [[f.identityDocument, f.identityNumber.trim() || 'Not set'] as [string, string]] : []),
                  ['Registered on', f.registeredOn ? fmt(new Date(`${f.registeredOn}T00:00`)) : 'Not set'],
                  ['Tax number', f.taxNumber.trim() || 'Not set'],
                  ['Time zone', f.timezone ?? 'Not set'],
                  ['Institution types', f.types.codes.map((c) => `${typeName(c)}${c === f.types.primary && f.types.codes.length > 1 ? ' (primary)' : ''}`).join(', ') || 'Not set'],
                  ['Contact', [f.email.trim(), f.phone.trim()].filter(Boolean).join(' · ') || 'Not set'],
                  ['Tenant tree', f.tree === 'Child' ? `Child of ${parentName ?? 'not picked'}` : 'Standalone / can take children'],
                ]}
              />
              <ReviewCard
                title="Address"
                onEdit={() => setStep(1)}
                lines={[
                  ['Address', [f.addr.trim(), f.city !== '—' ? f.city : '', f.district, f.addrCountry, f.postal.trim()].filter(Boolean).join(', ') || 'Not set'],
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
                title="People to invite"
                onEdit={() => setStep(3)}
                lines={[
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
              <Button onClick={create_}>
                Create tenant
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
