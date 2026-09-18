import { useState } from 'react'
import { Input } from '@workspace/ui/components/input'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { useToast } from '@workspace/ui/components/toast'
import { FormModal, FormModalField, FormModalGrid, FormModalWarning } from '@workspace/ui/components/form-modal'
import { useActiveCountries, useGeographies, useGeographyActions, useGeographyTypes, useTopLevelGeographies } from './queries'
import type { AddCountryInput, GeographyType } from './types'

type GeoForm = { country: string; type: GeographyType; parent: string; name: string; postal: string }

/** "Add a geography" modal. Remounts its form on every open. */
export function AddGeographyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <FormModal open={open} onClose={onClose} title="Add a geography" note="Geographies are shared across every tenant, so names should match the official register." saveLabel="Add geography" onSave={() => (document.getElementById('add-geography-form') as HTMLFormElement | null)?.requestSubmit()}>
      {open && <GeographyForm onDone={onClose} />}
    </FormModal>
  )
}

function GeographyForm({ onDone }: { onDone: () => void }) {
  const countries = useActiveCountries()
  const types = useGeographyTypes()
  const places = useGeographies()
  const { addGeography } = useGeographyActions()
  const toast = useToast()
  const first = countries.find((c) => c.name === 'Maldives')?.name ?? countries.at(0)?.name ?? ''
  const [form, setForm] = useState<GeoForm>({ country: first, type: 'Atoll', parent: first, name: '', postal: '' })
  const topLevel = useTopLevelGeographies(form.country)
  const set = <TKey extends keyof GeoForm>(k: TKey, v: GeoForm[TKey]) => setForm((f) => ({ ...f, [k]: v }))

  const name = form.name.trim()
  const clash = !!name && places.some((g) => g.name.toLowerCase() === name.toLowerCase())

  const submit = () => {
    if (!name) return toast('Give the geography a name first.', { ok: false })
    const result = addGeography({ country: form.country, type: form.type, parent: form.parent, name, postal: form.postal })
    if (!result.ok) return toast(result.reason, { ok: false })
    toast(`${name} added under ${form.parent || form.country}.`, { undo: result.undo })
    onDone()
  }

  return (
    <form id="add-geography-form" onSubmit={(e) => (e.preventDefault(), submit())}>
      <FormModalGrid>
        <FormModalField label="Country" htmlFor="geo-country">
          <NativeSelect id="geo-country" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value, parent: e.target.value }))}>
            {countries.map((c) => (
              <option key={c.code} value={c.name}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </FormModalField>
        <FormModalField label="Geography type" htmlFor="geo-type">
          <NativeSelect id="geo-type" value={form.type} onChange={(e) => set('type', e.target.value as GeographyType)}>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </NativeSelect>
        </FormModalField>
        <FormModalField label="Sits under" htmlFor="geo-parent" wide hint="Pick the country itself for a top-level atoll or state.">
          <NativeSelect id="geo-parent" value={form.parent} onChange={(e) => set('parent', e.target.value)}>
            <option value={form.country}>{form.country}</option>
            {topLevel.map((g) => (
              <option key={g.name}>{g.name}</option>
            ))}
          </NativeSelect>
        </FormModalField>
        <FormModalField label="Name" htmlFor="geo-name">
          <Input id="geo-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Eydhafushi" aria-invalid={clash || undefined} autoFocus />
        </FormModalField>
        <FormModalField label="Postal code (optional)" htmlFor="geo-postal">
          <Input id="geo-postal" value={form.postal} onChange={(e) => set('postal', e.target.value)} placeholder="06040" />
        </FormModalField>
      </FormModalGrid>
      {clash && <FormModalWarning>A geography called {name} already exists. Two places with the same name confuse every tenant’s site list.</FormModalWarning>}
      <button type="submit" hidden />
    </form>
  )
}

/** "Add a country" modal. Remounts its form on every open. */
export function AddCountryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <FormModal open={open} onClose={onClose} title="Add a country" note="Only countries added here can be picked on a tenant address." saveLabel="Add country" onSave={() => (document.getElementById('add-country-form') as HTMLFormElement | null)?.requestSubmit()}>
      {open && <CountryForm onDone={onClose} />}
    </FormModal>
  )
}

function CountryForm({ onDone }: { onDone: () => void }) {
  const { addCountry } = useGeographyActions()
  const toast = useToast()
  const [form, setForm] = useState<AddCountryInput>({ name: '', code: '', dial: '' })
  const set = (k: keyof AddCountryInput) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = () => {
    if (!form.name.trim() || !form.code.trim() || !form.dial.trim()) return toast('Fill in the name, code and dialing code.', { ok: false })
    const result = addCountry(form)
    if (!result.ok) return toast(result.reason, { ok: false })
    toast(`${form.name.trim()} added.`, { undo: result.undo })
    onDone()
  }

  return (
    <form id="add-country-form" onSubmit={(e) => (e.preventDefault(), submit())}>
      <FormModalGrid>
        <FormModalField label="Country name" htmlFor="country-name" wide>
          <Input id="country-name" value={form.name} onChange={set('name')} placeholder="Maldives" autoFocus />
        </FormModalField>
        <FormModalField label="Country code" htmlFor="country-code">
          <Input id="country-code" value={form.code} onChange={set('code')} placeholder="MV" maxLength={2} className="uppercase" />
        </FormModalField>
        <FormModalField label="Dialing code" htmlFor="country-dial">
          <Input id="country-dial" value={form.dial} onChange={set('dial')} placeholder="+960" />
        </FormModalField>
      </FormModalGrid>
      <button type="submit" hidden />
    </form>
  )
}
