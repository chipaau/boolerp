import { useQuery } from '@tanstack/react-query'
import { ComboboxField } from '@workspace/ui/components/combobox'
import { referenceQueries } from './api'
import { legalFormOptions } from './options'
import type { LegalForm } from './schemas'

type Props = {
  /** The country whose legal forms are offered; none, and the picker waits for one. */
  country: string | null
  value: string | null
  /** The chosen form's id, and the form itself, so the caller can ask for its identity document. */
  onValueChange: (id: string | null, form: LegalForm | null) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}

/** Picks one of a country's legal forms, grouped by category, with the document each one names. */
export function LegalFormSelect({ country, value, onValueChange, placeholder = 'Search legal forms', disabled, ...rest }: Props) {
  const { data, isFetching, isError } = useQuery(referenceQueries.legalForms(country ?? ''))
  return (
    <ComboboxField
      value={value}
      onValueChange={(v) => onValueChange(v, data?.find((f) => f.id === v) ?? null)}
      options={data ? legalFormOptions(data) : []}
      placeholder={
        !country ? 'Pick the country first' : isFetching && !data ? 'Loading legal forms…' : isError ? 'Legal forms could not be loaded' : placeholder
      }
      emptyText={data?.length === 0 ? 'This country has no legal forms yet.' : 'No legal form matches.'}
      disabled={disabled || !country || !data}
      {...rest}
    />
  )
}
