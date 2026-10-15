import { useMemo } from 'react'
import { ComboboxField } from '@workspace/ui/components/combobox'
import { timezoneOptions, timezones } from './timezones'

type Props = {
  value: string | null
  onValueChange: (zone: string | null) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/** Picks an IANA time zone from the browser's list, grouped by region, its UTC offset beside it. */
export function TimezoneSelect({ value, onValueChange, placeholder = 'Search time zones', ...rest }: Props) {
  const options = useMemo(() => timezoneOptions(timezones()), [])
  return <ComboboxField value={value} onValueChange={onValueChange} options={options} placeholder={placeholder} emptyText="No time zone matches." {...rest} />
}
