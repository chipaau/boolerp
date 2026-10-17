import { useForm, useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { formAt, INVALID_FORM_MESSAGE, useApiMutation } from '@workspace/api'
import { addressLevels, needsAnotherPick, pickerLabel, typedLevels } from '@workspace/reference/address'
import type { AddressLevel } from '@workspace/reference/address'
import { referenceQueries } from '@workspace/reference/api'
import { CountrySelect } from '@workspace/reference/country-select'
import { GeographySelect } from '@workspace/reference/geography-select'
import type { Geography } from '@workspace/reference/schemas'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { FormErrorBanner, FormField, TextField } from '@workspace/ui/components/form-field'
import type { FormErrors } from '@workspace/api'
import { useToast } from '@workspace/ui/components/toast'
import { Field } from '@/components/form-field'
import { tenantMutations, tenantQueries } from './api'
import { addressLine, addressStepSchema, emptyAddress, toAddressInput } from './schemas'
import type { AddressStep, Tenant } from './schemas'

/** The id of step 2's form, which the wizard's footer button submits. */
export const ADDRESS_FORM_ID = 'tenant-address-form'

type Prefix = 'registered' | 'mailing'

/** Step 2's form: the registered address, and the mailing one when it is not the same (C217). */
function useAddressStepForm(tenant: Tenant, onSubmit: (value: AddressStep) => Promise<void>) {
  const toast = useToast()
  return useForm({
    defaultValues: {
      registered: emptyAddress(tenant.country),
      mailingIsRegistered: true,
      mailing: emptyAddress(tenant.country),
    },
    validators: { onChange: addressStepSchema, onSubmit: addressStepSchema },
    onSubmit: ({ value }) => onSubmit(value),
    onSubmitInvalid: () => toast(INVALID_FORM_MESSAGE, { ok: false }),
  })
}
type StepForm = ReturnType<typeof useAddressStepForm>

/**
 * The wizard's step 2 for a tenant just created (C217): its registered address, and the mailing one
 * when it differs. Saving puts the registered address, then the mailing one; the API's 422 lands on
 * the right address's fields (formAt). The step cannot be passed without saving.
 */
export function TenantAddressStep({ tenant, onSaved, onBusy }: { tenant: Tenant; onSaved: () => void; onBusy: (busy: boolean) => void }) {
  const toast = useToast()
  const form = useAddressStepForm(tenant, async (value) => {
    onBusy(true)
    try {
      await registered.mutateAsync(toAddressInput(value.registered))
      if (!value.mailingIsRegistered) await mailing.mutateAsync(toAddressInput(value.mailing))
      toast('Address saved')
      onSaved()
    } catch {
      // The one error policy toasted it (C185); a 422 is also on the address's fields.
    } finally {
      onBusy(false)
    }
  })
  const registered = useApiMutation({ ...tenantMutations.setAddress(tenant.id, 'registered'), form: formAt(form, 'registered') })
  const mailing = useApiMutation({ ...tenantMutations.setAddress(tenant.id, 'mailing'), form: formAt(form, 'mailing') })
  const mailingIsRegistered = useStore(form.store, (s) => s.values.mailingIsRegistered)

  return (
    <form
      id={ADDRESS_FORM_ID}
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <AddressFields form={form} prefix="registered" title="Registered address" errors={registered.formErrors} />
      <form.Field name="mailingIsRegistered">
        {(field) => (
          <label className="flex cursor-pointer items-center gap-2.5 text-compact text-body">
            <Checkbox checked={field.state.value} onCheckedChange={(v) => field.handleChange(Boolean(v))} />
            Mailing address is the same as the registered address
          </label>
        )}
      </form.Field>
      {!mailingIsRegistered && <AddressFields form={form} prefix="mailing" title="Mailing address" errors={mailing.formErrors} />}
    </form>
  )
}

/**
 * One address's fields (C215, C217): its country, a picker under a picker for the levels with places
 * listed, down to a place with nothing under it (the deepest carries the API's geographyId error), a
 * text field for each level with none, and the street part.
 */
function AddressFields({ form, prefix, title, errors }: { form: StepForm; prefix: Prefix; title: string; errors: FormErrors | null }) {
  const address = useStore(form.store, (s) => s.values[prefix])
  const types = useQuery(referenceQueries.geographyTypes(address.country))
  const levels = addressLevels(types.data ?? [])
  const picked = address.places
  // A picker for each place picked, and one more while the last has places under it.
  const pickers = picked.length + (types.data && needsAnotherPick(levels, picked) ? 1 : 0)
  const quietly = { dontUpdateMeta: true, dontValidate: true } as const

  /** Picks `place` at picker `k`: the pickers below it go, and so do typed levels it now picks. */
  const pick = (k: number, place: Geography | null) => {
    const places = [...picked.slice(0, k), ...(place ? [{ id: place.id, level: place.level, hasChildren: place.hasChildren, name: place.name }] : [])]
    const deepest = places.at(-1)?.level ?? 0
    form.setFieldValue(`${prefix}.places`, places, quietly)
    form.setFieldValue(
      `${prefix}.typedPlaces`,
      Object.fromEntries(Object.entries(address.typedPlaces).filter(([code]) => levelOf(levels, code) > deepest)),
      quietly
    )
    return places.at(-1)?.id ?? ''
  }

  return (
    <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
      <legend className="mb-1 text-overline text-faint">{title}</legend>
      <form.Field
        name={`${prefix}.country`}
        listeners={{
          // Another country's places and levels are not this one's.
          onChange: () => {
            form.setFieldValue(`${prefix}.places`, [], quietly)
            form.setFieldValue(`${prefix}.geographyId`, '', quietly)
            form.setFieldValue(`${prefix}.typedPlaces`, {}, quietly)
          },
        }}
      >
        {(field) => (
          <FormField field={field} label="Country" required className="sm:col-span-2">
            {(c) => (
              <CountrySelect
                id={c.id}
                aria-label={`${title} country`}
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

      {Array.from({ length: pickers }, (_, k) => {
        const parent = k === 0 ? null : picked[k - 1]
        const label = pickerLabel(nextListedTypes(levels, parent?.level ?? 0), 'Place')
        const select = (props: { id: string; invalid?: boolean; describedBy?: string; onPicked: (id: string) => void }) => (
          <GeographySelect
            key={`${address.country}-${parent?.id ?? 'top'}`}
            id={props.id}
            aria-label={`${title} ${label.toLowerCase()}`}
            aria-required
            aria-invalid={props.invalid}
            aria-describedby={props.describedBy}
            country={address.country}
            parent={parent?.id ?? null}
            value={picked[k]?.id ?? null}
            onValueChange={(_id, place) => props.onPicked(pick(k, place))}
          />
        )
        if (k < pickers - 1) {
          const id = `${prefix}-place-${k}`
          return (
            <Field key={id} id={id} label={label} required>
              {select({ id, onPicked: (deepest) => form.setFieldValue(`${prefix}.geographyId`, deepest, quietly) })}
            </Field>
          )
        }
        return (
          <form.Field key={`${prefix}-deepest`} name={`${prefix}.geographyId`}>
            {(field) => (
              <FormField field={field} label={label} required>
                {(c) => select({ id: c.id, invalid: c.invalid, describedBy: c.describedBy, onPicked: c.onChange })}
              </FormField>
            )}
          </form.Field>
        )
      })}

      {typedLevels(levels, picked).map((t) => (
        <form.Field key={t.code} name={`${prefix}.typedPlaces.${t.code}`}>
          {(field) => <TextField field={field} label={t.label} required placeholder={t.label} />}
        </form.Field>
      ))}

      <form.Field name={`${prefix}.line1`}>
        {(field) => (
          <TextField
            field={field}
            label="Address"
            required
            placeholder="H. Sosun Villa, Sosun Magu"
            hint="The house or building, and the street."
            className="sm:col-span-2"
          />
        )}
      </form.Field>
      <form.Field name={`${prefix}.line2`}>{(field) => <TextField field={field} label="Address line 2" placeholder="3rd floor" />}</form.Field>
      <form.Field name={`${prefix}.postalCode`}>{(field) => <TextField field={field} label="Postal code" placeholder="20026" />}</form.Field>
      <FormErrorBanner errors={errors} className="sm:col-span-2" />
    </fieldset>
  )
}

/** The level of a country's type `code`, or 0 when it is none of its types. */
function levelOf(levels: readonly AddressLevel[], code: string) {
  return levels.find((l) => l.types.some((t) => t.code === code))?.level ?? 0
}

/** The listed types the next picker offers: those of the first listed level below `level`. */
function nextListedTypes(levels: readonly AddressLevel[], level: number) {
  return levels.find((l) => l.listed && l.level > level)?.types.map((t) => ({ typeName: t.name })) ?? []
}

/** The review step's lines for a tenant's saved addresses (C217): the registered one, and the mailing one or that it is the same. */
export function useTenantAddressLines(tenant: Tenant | null, countryName: (code: string) => string): [string, string][] {
  const addresses = useQuery({ ...tenantQueries.addresses(tenant?.id ?? ''), enabled: tenant !== null }).data?.items ?? []
  const of = (kind: string) => addresses.find((a) => a.kind === kind)
  const registered = of('registered')
  const mailing = of('mailing')
  return [
    ['Registered address', registered ? addressLine(registered, countryName) : 'Not set'],
    ['Mailing address', mailing ? addressLine(mailing, countryName) : 'Same as the registered address'],
  ]
}
