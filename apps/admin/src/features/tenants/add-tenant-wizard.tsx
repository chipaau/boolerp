import { useState } from 'react'
import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useForm, useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { INVALID_FORM_MESSAGE, useApiMutation } from '@workspace/api'
import { referenceQueries } from '@workspace/reference/api'
import { CountrySelect } from '@workspace/reference/country-select'
import { InstitutionTypesField } from '@workspace/reference/institution-types-field'
import { LegalFormSelect } from '@workspace/reference/legal-form-select'
import { TimezoneSelect } from '@workspace/reference/timezone-select'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { ComboboxField } from '@workspace/ui/components/combobox'
import { DatePicker } from '@workspace/ui/components/date-picker'
import { Dialog, DialogContent } from '@workspace/ui/components/dialog'
import { FormErrorBanner, FormField, TextField } from '@workspace/ui/components/form-field'
import { SelectField } from '@workspace/ui/components/select'
import { Segmented, SegmentedItem } from '@workspace/ui/components/segmented'
import { Stepper, StepperFooter, StepperLayout } from '@workspace/ui/components/stepper'
import { useToast } from '@workspace/ui/components/toast'
import { ADDRESS_FORM_ID, TenantAddressStep, useTenantAddressLines } from './tenant-address-step'
import { TenantAppsStep, useTenantAppLines, useTenantApps } from './tenant-apps-step'
import { cn } from '@workspace/ui/lib/utils'
import { Field, ReviewCard, StepHeading, fieldClass } from '@/components/form-field'
import { useCurrentUser } from '@/components/layout/user-context'
import { useActiveCountries, useChildGeographies, useTopLevelGeographies } from '@/features/geographies/queries'
import { tenantMutations, tenantQueries } from './api'
import { useAppCatalog, useCoreApps, useTenantDirectory, useTenantProfileActions } from './queries'
import { newTenantForm, newTenantFormSchema, toCreateTenantInput } from './schemas'
import type { NewTenantForm, Tenant } from './schemas'
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
// The ledes that differ when the steps are saved to the API: only where the prototype's would be
// untrue (C226): the address must be saved to go on (C223).
const LEDES: Partial<Record<number, string>> = {
  1: 'Where the tenant is registered, printed on its invoices. Save it to go on.',
}
const appLabel = (a: AppName) => a

type DraftAdmin = { name: string; idNo: string; email: string; nat: Nationality }

type Form = {
  // The later steps, still the prototype's (the address uses its geography fixtures). Step 1, the
  // request that creates the tenant (C197), is the TanStack form below.
  addr: string; addrCountry: string; district: string; city: string; postal: string; sameAsReg: boolean
  apps: TenantApps; nat: Nationality; aName: string; aId: string; aEmail: string; admins: DraftAdmin[]
}

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40)
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const today = () => fmt(new Date())
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
/** A value the form sets itself: the field is neither touched nor validated (which would touch it). */
const quietly = { dontUpdateMeta: true, dontValidate: true } as const

/**
 * Add a tenant in a large stepped dialog (the New employee pattern): a Stepper rail on the left,
 * one step body on the right. A step can only be moved past once complete; later steps stay locked
 * until then. Step 1 is the request that creates the tenant in provisioning (C197): name, slug,
 * code, country, legal form (and the number of the document it names), time zone, and institution
 * types are required; the reference lists come from the API (C199) through @workspace/reference.
 * "Create tenant" is offered as soon as step 1 is complete: owners are needed to activate a tenant
 * (C198), not to create it. Step 1 is a TanStack form validated by zod (C176); with `onCreated` it
 * sends POST /api/v1/tenants, and the API's 422 lands on its fields (useApiMutation) or, for what
 * no field can show, in the banner above them. The created tenant then stays open in the wizard on
 * step 2, its registered address, which must be saved to go on (C223); step 1 is done and is not
 * reopened, and the last step ends with Done. Step 3 turns its apps on and off, each saved at once
 * (C224). Steps 4 and 5 are still the prototype's. Without
 * `onCreated` (the design prototype's page) it saves the prototype's fixture profile.
 */
export function AddTenantWizard({
  onClose,
  onProvisioned,
  onCreated,
}: {
  onClose: () => void
  onProvisioned: (p: Provisioned) => void
  /** Creates the tenant through the API (F3) and reports it, the wizard staying open on its address; without it, the prototype's fixtures. */
  onCreated?: (tenant: Tenant) => void
}) {
  const toast = useToast()
  const user = useCurrentUser()
  const { create: saveProfile } = useTenantProfileActions()
  const { tenants } = useTenantDirectory()
  const catalog = useAppCatalog()
  const core = useCoreApps()
  const countries = useActiveCountries()

  const [step, setStep] = useState(0)
  // The tenant step 1 created (C223): the wizard goes on with it, and step 1 is done.
  const [created, setCreated] = useState<Tenant | null>(null)
  const [addressSaved, setAddressSaved] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const [f, setF] = useState<Form>(() => ({
    addr: '', addrCountry: 'Maldives', district: 'Kaafu', city: 'Malé City', postal: '', sameAsReg: true,
    apps: Object.fromEntries(core.map((a) => [a, catalog.find((c) => c.name === a)?.modules ?? []])),
    nat: 'Maldivian', aName: '', aId: '', aEmail: '', admins: [],
  }))
  const set = <TKey extends keyof Form>(k: TKey, v: Form[TKey]) => setF((prev) => ({ ...prev, [k]: v }))

  // Step 1: the creating request (C176, C197).
  const form = useForm({
    defaultValues: newTenantForm,
    validators: { onChange: newTenantFormSchema, onSubmit: newTenantFormSchema },
    onSubmit: async ({ value }) => {
      if (!onCreated) return createInPrototype(value)
      try {
        const tenant = await create.mutateAsync(toCreateTenantInput(value))
        toast(`${tenant.name} created`)
        setCreated(tenant)
        setStep(1)
        onCreated(tenant)
      } catch {
        // The one error policy toasted it (C185); a 422 is also on the fields and banner.
      }
    },
  })
  const create = useApiMutation({ ...tenantMutations.create(), form })
  const values = useStore(form.store, (state) => state.values)
  // The pickers' lists, from the same cache, to name the choices on the review step.
  const refCountries = useQuery(referenceQueries.countries()).data
  const legalForms = useQuery(referenceQueries.legalForms(values.country)).data
  const institutionTypes = useQuery(referenceQueries.institutionTypes()).data
  const countryName = (code: string | null) => (code ? (refCountries?.find((c) => c.code === code)?.name ?? code) : undefined)
  const legalFormName = legalForms?.find((l) => l.id === values.legalFormId)?.name
  const typeName = (code: string) => institutionTypes?.find((t) => t.code === code)?.name ?? code

  const districts = useTopLevelGeographies(f.addrCountry)
  const cities = useChildGeographies(f.district)

  // The prototype's fixtures name a slug they hold; the API names its own (a 422 on the slug).
  const slugDupe = !onCreated && values.slug.trim() ? tenants.find((t) => t.slug === values.slug.trim()) : undefined
  // A parent is one of the API's tenants, shown by name and chosen by id (C197's parentId).
  const apiTenants = useQuery(tenantQueries.list({ page: 1, pageSize: 100, sort: 'name' })).data?.items
  const parentOptions = (apiTenants ?? [])
    .filter((t) => t.status !== 'archived')
    .map((t) => ({ value: t.id, label: t.name, detail: t.code, keywords: `${t.code} ${t.slug}` }))
  const parentName = apiTenants?.find((t) => t.id === values.parentId)?.name
  const adminCount = f.admins.length

  /** What still stops step `i` from being complete; empty = passable. */
  const missing = (i: number): string[] => {
    const out: string[] = []
    if (i === 0) {
      const parsed = newTenantFormSchema.safeParse(values)
      if (!parsed.success) out.push(...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))))
      if (slugDupe) out.push(`a slug not already used by ${slugDupe.abbr}`)
    }
    if (i === 1 && created && !addressSaved) out.push('the registered address, saved')
    return out
  }
  // With the API, step 2 is complete once its address is saved, not merely when nothing is missing.
  const complete = (i: number) => (i === 1 && onCreated ? addressSaved : missing(i).length === 0)
  // Creating needs step 1 only (C197); the later steps can be finished on the details page.
  const ready = complete(0)

  /**
   * Toasts what step `i` is missing and returns true when it cannot be passed; for step 1 it also
   * shows each error on its field, touching them all as a submit does (the form is step 1's).
   */
  const blocked = (i: number) => {
    const m = missing(i)
    if (!m.length) return false
    if (i === 0) {
      // The API's 422 says the same (C185); each field says what is wrong with it.
      toast(INVALID_FORM_MESSAGE, { ok: false })
      void form.validateAllFields('submit')
      void form.validate('submit')
    } else toast(`${STEPS[i].title} still needs ${m.join(', ')}.`, { ok: false })
    return true
  }
  /**
   * Back is always allowed, except to step 1 once it created the tenant; forward only past complete
   * steps (lands on the first incomplete one), and past step 1 only once the tenant is created.
   */
  const go = (n: number) => {
    if (onCreated && created && n === 0) return toast(`${created.name} is created; its details are changed on its page.`)
    if (onCreated && !created && n > 0) {
      if (!blocked(0)) toast('Create the tenant first: the later steps are saved to it.', { ok: false })
      return setStep(0)
    }
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
      slug, name, abbr: (values.code.trim() || name.slice(0, 4)).toUpperCase(), regNo: values.identityNumber.trim() || '—',
      orgType: 'Not set', entityType: 'Not set',
      parentSlug: null, // the parent is an API tenant, not one of the prototype's fixtures
      plan: 'Basic', seatsUsed: 0, seatLimit: 0, status,
      activeFrom: status === 'Active' ? today() : '—',
      contact: values.phone.trim() || '—', email: values.email.trim() || '—',
      country: f.addrCountry, district: f.city && f.city !== '—' ? f.city : f.district,
      addr: f.addr.trim() || '—', mail: f.sameAsReg ? 'Same as registered address' : '—',
      apps, admins,
      activity: [{ when: today(), what: status === 'Draft' ? 'Saved as draft' : 'Tenant created and activated', who: user.name }],
    }
  }

  /** The prototype's create: its fixture profile, as before the API (F2f). */
  const createInPrototype = (value: NewTenantForm) => {
    const input = { name: value.name.trim(), slug: value.slug.trim() }
    saveProfile(profileFrom(input.slug, input.name, 'Active'))
    toast(`${input.name} created`)
    onProvisioned({ name: input.name, recoveryLink: 'Not provisioned — this is the design prototype.' })
  }

  /** Validates step 1 (showing its errors on the fields) and submits it. */
  const create_ = () => {
    if (blocked(0)) setStep(0)
    void form.handleSubmit()
  }

  const saveDraft = () => {
    const name = values.name.trim() || 'Untitled tenant'
    const slug = values.slug.trim() || slugify(name) || `draft-${Date.now()}`
    saveProfile(profileFrom(slug, name, 'Draft'))
    toast('Draft saved. It stays in the tenant list marked Draft.')
    onClose()
  }

  const optional = catalog.filter((a) => !core.includes(a.name))
  const extraApps = optional.filter((a) => f.apps[a.name]).length
  const last = STEPS.length - 1
  // The review's apps and addresses, read when it opens: the steps before have saved them by then.
  const appLines = useTenantAppLines(step === last ? created : null)
  // The apps step's note counts the tenant's other apps that are on, as the prototype's does.
  const tenantApps = useTenantApps(step >= 2 ? created : null)
  const extraTenantApps = tenantApps.filter((a) => a.on && !a.isDefault).length
  const addressLines = useTenantAddressLines(step === last ? created : null, (code) => countryName(code) ?? code)
  const notes = onCreated
    ? [
        ready ? 'Ready to create. Its address comes next.' : 'Creating the tenant needs this step only.',
        addressSaved ? 'Saved. Saving again replaces it.' : 'Needed to go on.',
        `Control Centre and Calendar are included${extraTenantApps ? ` · ${extraTenantApps} more ${extraTenantApps === 1 ? 'app' : 'apps'}` : ''}.`,
        'Not saved yet: the tenant’s page will invite them.',
        `${created?.name ?? 'The tenant'} and its address are saved.`,
      ]
    : [
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
          <StepHeading
            title={HEADINGS[step][0]}
            lede={onCreated && LEDES[step] ? LEDES[step] : HEADINGS[step][1]}
          />

          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormErrorBanner errors={create.formErrors} className="sm:col-span-2" />
              <form.Field
                name="name"
                listeners={{ onChange: ({ value }) => !slugTouched && form.setFieldValue('slug', slugify(value), quietly) }}
              >
                {(field) => (
                  <TextField field={field} label="Name" required autoFocus className="sm:col-span-2" placeholder="e.g. National Centre for Information Technology" />
                )}
              </form.Field>
              <form.Field
                name="slug"
                // Typed by hand once it differs from what the name gives; then the name no longer sets it.
                listeners={{ onChange: ({ value }) => setSlugTouched(value !== slugify(form.getFieldValue('name'))) }}
              >
                {(field) => (
                  <TextField
                    field={field}
                    label="Slug"
                    required
                    hint={slugDupe ? `Already used by ${slugDupe.abbr}.` : 'The tenant’s web address: slug.bool.mv'}
                    placeholder="ncit"
                    inputClassName="font-mono text-compact"
                  />
                )}
              </form.Field>
              <form.Field name="code">
                {(field) => <TextField field={field} label="Code" required hint="Short name shown across the platform, e.g. NCIT." placeholder="NCIT" />}
              </form.Field>

              <div className="grid gap-4 border-t border-divider pt-[18px] sm:col-span-2 sm:grid-cols-2">
                <div className="text-overline text-faint sm:col-span-2">Registration</div>
                <form.Field
                  name="country"
                  listeners={{
                    // Another country's legal forms are not this one's: the form and its number go.
                    // Quietly: they are not marked touched, so no error shows until someone edits them.
                    onChange: () => {
                      form.setFieldValue('legalFormId', '', quietly)
                      form.setFieldValue('identityDocument', null, quietly)
                      form.setFieldValue('identityNumber', '', quietly)
                    },
                  }}
                >
                  {(field) => (
                    <FormField field={field} label="Country" required hint="Where the organisation is registered. Its legal forms follow.">
                      {(c) => (
                        <CountrySelect
                          id={c.id}
                          aria-label="Country"
                          aria-required
                          aria-invalid={c.invalid}
                          aria-describedby={c.describedBy}
                          value={c.value || null}
                          onValueChange={(country) => c.onChange(country ?? '')}
                        />
                      )}
                    </FormField>
                  )}
                </form.Field>
                <form.Field name="legalFormId">
                  {(field) => (
                    <FormField field={field} label="Legal form" required>
                      {(c) => (
                        <LegalFormSelect
                          id={c.id}
                          aria-label="Legal form"
                          aria-required
                          aria-invalid={c.invalid}
                          aria-describedby={c.describedBy}
                          country={values.country || null}
                          value={c.value || null}
                          onValueChange={(legalFormId, legalForm) => {
                            c.onChange(legalFormId ?? '')
                            form.setFieldValue('identityDocument', legalForm?.identityDocument ?? null, quietly)
                            if (!legalForm?.identityDocument) form.setFieldValue('identityNumber', '', quietly)
                          }}
                        />
                      )}
                    </FormField>
                  )}
                </form.Field>
                {values.identityDocument && (
                  <form.Field name="identityNumber">
                    {(field) => (
                      <TextField
                        field={field}
                        label={values.identityDocument ?? ''}
                        required
                        hint="The number on the document this legal form carries. One organisation per number in a country."
                        placeholder="C-1024/2026"
                      />
                    )}
                  </form.Field>
                )}
                <form.Field name="registeredOn">
                  {(field) => (
                    <FormField field={field} label="Registered on">
                      {(c) => <DatePicker id={c.id} value={c.value} onChange={c.onChange} placeholder="Pick the registration date" />}
                    </FormField>
                  )}
                </form.Field>
                <form.Field name="taxNumber">
                  {(field) => <TextField field={field} label="Tax number" hint="The TIN printed on invoices, if they have one." placeholder="1012345GST501" />}
                </form.Field>
                <form.Field name="timezone">
                  {(field) => (
                    <FormField field={field} label="Time zone" required hint="Their working days and times are kept in this zone.">
                      {(c) => (
                        <TimezoneSelect
                          id={c.id}
                          aria-label="Time zone"
                          aria-required
                          aria-invalid={c.invalid}
                          aria-describedby={c.describedBy}
                          value={c.value || null}
                          onValueChange={(timezone) => c.onChange(timezone ?? '')}
                        />
                      )}
                    </FormField>
                  )}
                </form.Field>
              </div>

              <div className="border-t border-divider pt-[18px] sm:col-span-2">
                <form.Field name="institutionTypes">
                  {(field) => (
                    <FormField
                      field={field}
                      label="Institution types"
                      required
                      hint="What they do. Pick one or more; with several, mark the primary one. Their sector follows from it."
                    >
                      {(c) => (
                        <InstitutionTypesField
                          id={c.id}
                          aria-label="Institution types"
                          aria-required
                          aria-invalid={c.invalid}
                          aria-describedby={c.describedBy}
                          value={{ codes: c.value.map((t) => t.code), primary: c.value.find((t) => t.primary)?.code ?? null }}
                          onValueChange={(types) => c.onChange(types.codes.map((code) => ({ code, primary: code === types.primary })))}
                        />
                      )}
                    </FormField>
                  )}
                </form.Field>
              </div>

              <div className="grid gap-4 border-t border-divider pt-[18px] sm:col-span-2 sm:grid-cols-2">
                <div className="text-overline text-faint sm:col-span-2">Contact · optional</div>
                <form.Field name="email">
                  {(field) => <TextField field={field} label="E-mail address" type="email" placeholder="info@tenant.gov.mv" />}
                </form.Field>
                <form.Field name="phone">
                  {(field) => (
                    <TextField field={field} label="Phone" hint="International form, e.g. +960 332 4568." placeholder="+960 332 4568" inputMode="tel" />
                  )}
                </form.Field>
              </div>

              <div className="border-t border-divider pt-[18px] sm:col-span-2">
                <div className="mb-2 text-overline text-faint">Place in the tenant tree</div>
                <form.Field name="tree">
                  {(field) => (
                    <div role="radiogroup" aria-label="Place in the tenant tree" className="grid gap-2.5 sm:grid-cols-2">
                      {(
                        [
                          ['Standalone', 'Standalone or parent', 'Stands on its own. Other tenants can later be added under it.'],
                          ['Child', 'Child of another tenant', 'Its parent may publish data for it to read.'],
                        ] as const
                      ).map(([k, label, sub]) => (
                        <PickCard key={k} on={field.state.value === k} onClick={() => field.handleChange(k)}>
                          <Radio on={field.state.value === k} />
                          <span className="min-w-0">
                            <span className="block text-ui-sm font-bold text-foreground">{label}</span>
                            <span className="mt-0.5 block text-caption leading-[1.45] text-faint">{sub}</span>
                          </span>
                        </PickCard>
                      ))}
                    </div>
                  )}
                </form.Field>
                {values.tree === 'Child' && (
                  <form.Field name="parentId">
                    {(field) => (
                      <FormField
                        field={field}
                        label="Parent tenant"
                        required
                        className="mt-3.5 max-w-[420px]"
                        hint="A child keeps its own admins and data; the parent sees nothing inside it."
                      >
                        {(c) => (
                          <ComboboxField
                            id={c.id}
                            aria-label="Parent tenant"
                            aria-required
                            aria-invalid={c.invalid}
                            aria-describedby={c.describedBy}
                            value={c.value || null}
                            onValueChange={(parentId) => c.onChange(parentId ?? '')}
                            options={parentOptions}
                            placeholder={apiTenants ? 'Search tenants by name or code' : 'Loading tenants…'}
                            emptyText="No tenant matches."
                            disabled={!apiTenants}
                          />
                        )}
                      </FormField>
                    )}
                  </form.Field>
                )}
              </div>
            </div>
          )}

          {/* Kept mounted, so the address survives going on and coming back. */}
          {created && (
            <div hidden={step !== 1}>
              <TenantAddressStep
                tenant={created}
                onBusy={setSavingAddress}
                onSaved={() => {
                  setAddressSaved(true)
                  setStep(2)
                }}
              />
            </div>
          )}

          {step === 1 && !onCreated && (
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

          {step === 2 && created && <TenantAppsStep tenant={created} />}

          {step === 2 && !onCreated && (
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
                  ['Name', values.name.trim() || 'Not set'],
                  ['Slug · code', `${values.slug.trim() || '—'} · ${values.code.trim() || '—'}`],
                  ['Country', countryName(values.country || null) ?? 'Not set'],
                  ['Legal form', legalFormName ?? 'Not set'],
                  ...(values.identityDocument ? [[values.identityDocument, values.identityNumber.trim() || 'Not set'] as [string, string]] : []),
                  ['Registered on', values.registeredOn ? fmt(new Date(`${values.registeredOn}T00:00`)) : 'Not set'],
                  ['Tax number', values.taxNumber.trim() || 'Not set'],
                  ['Time zone', values.timezone || 'Not set'],
                  ['Institution types', values.institutionTypes.map((t) => `${typeName(t.code)}${t.primary && values.institutionTypes.length > 1 ? ' (primary)' : ''}`).join(', ') || 'Not set'],
                  ['Contact', [values.email.trim(), values.phone.trim()].filter(Boolean).join(' · ') || 'Not set'],
                  ['Tenant tree', values.tree === 'Child' ? `Child of ${parentName ?? 'not picked'}` : 'Standalone / can take children'],
                ]}
              />
              <ReviewCard
                title="Address"
                onEdit={() => setStep(1)}
                lines={
                  created
                    ? addressLines
                    : [
                        ['Address', [f.addr.trim(), f.city !== '—' ? f.city : '', f.district, f.addrCountry, f.postal.trim()].filter(Boolean).join(', ') || 'Not set'],
                        ['Mailing address', f.sameAsReg ? 'Same as address' : 'Separate, not yet filled'],
                      ]
                }
              />
              <ReviewCard
                title="Apps & modules"
                onEdit={() => setStep(2)}
                lines={
                  created
                    ? appLines
                    : catalog
                        .filter((a) => f.apps[a.name] || core.includes(a.name))
                        .map((a) => [appLabel(a.name), core.includes(a.name) ? 'Included' : (f.apps[a.name] ?? []).join(', ')] as [string, string])
                }
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
            {/* No drafts once creating is real: the tenant is created in provisioning (C197). */}
            {!onCreated && (
              <Button variant="ghost" onClick={saveDraft}>
                Save as draft
              </Button>
            )}
            {onCreated ? (
              <>
                {step > 1 && (
                  <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                    Back
                  </Button>
                )}
                {step === 0 && (
                  <Button onClick={create_} disabled={create.isPending}>
                    {create.isPending ? 'Creating…' : 'Create tenant'}
                  </Button>
                )}
                {step === 1 && addressSaved && (
                  <Button variant="outline" onClick={() => go(2)}>
                    Continue
                  </Button>
                )}
                {step === 1 && (
                  <Button type="submit" form={ADDRESS_FORM_ID} disabled={savingAddress}>
                    {savingAddress ? 'Saving…' : 'Save and continue'}
                  </Button>
                )}
                {step > 1 && step < last && (
                  <Button onClick={() => go(step + 1)}>{step === last - 1 ? 'Review' : 'Continue'}</Button>
                )}
                {step === last && <Button onClick={onClose}>Done</Button>}
              </>
            ) : (
              <>
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
              </>
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
