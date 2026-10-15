import { useQuery } from '@tanstack/react-query'
import { ComboboxField } from '@workspace/ui/components/combobox'
import { referenceQueries } from './api'
import { countryOptions } from './options'

type Props = {
  value: string | null
  onValueChange: (code: string | null) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/** Picks a country by its ISO code: type a name or either code. */
export function CountrySelect({ value, onValueChange, placeholder = 'Search countries', disabled, ...rest }: Props) {
  const { data, isPending, isError } = useQuery(referenceQueries.countries())
  return (
    <ComboboxField
      value={value}
      onValueChange={onValueChange}
      options={data ? countryOptions(data) : []}
      placeholder={isPending ? 'Loading countries…' : isError ? 'Countries could not be loaded' : placeholder}
      emptyText="No country matches."
      disabled={disabled || !data}
      {...rest}
    />
  )
}
