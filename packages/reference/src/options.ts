// The reference lists as the pickers' options: what is shown, what the search also matches, and
// the group headings. Pure, so the pickers stay thin.
import type { ComboboxOption } from '@workspace/ui/components/combobox'
import type { Country, InstitutionType, LegalForm } from './schemas'

/** A country by name; its two codes are searchable and its dialling prefix shows beside it. */
export const countryOptions = (countries: readonly Country[]): ComboboxOption[] =>
  countries.map((c) => ({ value: c.code, label: c.name, keywords: `${c.code} ${c.alpha3}`, detail: c.phonePrefix }))

const CATEGORY: Record<LegalForm['category'], string> = {
  government: 'Government',
  private: 'Private',
  non_profit: 'Non-profit',
  international: 'International',
}

/** A legal form by name, under its category, with the identity document it names beside it. */
export const legalFormOptions = (forms: readonly LegalForm[]): ComboboxOption[] =>
  [...forms]
    .sort((a, b) => Object.keys(CATEGORY).indexOf(a.category) - Object.keys(CATEGORY).indexOf(b.category))
    .map((f) => ({ value: f.id, label: f.name, group: CATEGORY[f.category], detail: f.identityDocument ?? undefined }))

/** An institution type under its sector; the sector's name is searchable too. */
export const institutionTypeOptions = (types: readonly InstitutionType[]): ComboboxOption[] =>
  types.map((t) => ({ value: t.code, label: t.name, keywords: t.sector.name, group: t.sector.name }))
