import { useQuery } from '@tanstack/react-query'
import { ComboboxField } from '@workspace/ui/components/combobox'
import { referenceQueries } from './api'
import type { Geography } from './schemas'

type Props = {
  country: string
  /** The place whose places are offered; null for the country's level 1. */
  parent: string | null
  value: string | null
  onValueChange: (id: string | null, place: Geography | null) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}

/**
 * Picks one of the places under a parent, or a country's level 1 (C215): type its name, short name
 * ("K."), or code. When the choices are of several types (atolls and cities), each says its type.
 */
export function GeographySelect({ country, parent, value, onValueChange, placeholder = 'Search places', disabled, ...rest }: Props) {
  const { data, isPending, isError } = useQuery(referenceQueries.geographies(country, parent))
  const mixed = new Set((data ?? []).map((g) => g.type)).size > 1
  return (
    <ComboboxField
      value={value}
      onValueChange={(v) => onValueChange(v, data?.find((g) => g.id === v) ?? null)}
      options={(data ?? []).map((g) => ({
        value: g.id,
        label: g.shortName && g.shortName !== g.name ? `${g.shortName} ${g.name}` : g.name,
        keywords: [g.name, g.shortName, g.code].filter(Boolean).join(' '),
        detail: mixed ? g.typeName : undefined,
      }))}
      placeholder={isPending ? 'Loading places…' : isError ? 'Places could not be loaded' : placeholder}
      emptyText="No place matches."
      disabled={disabled || !data}
      {...rest}
    />
  )
}
