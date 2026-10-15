import { useQuery } from '@tanstack/react-query'
import { ComboboxMultiField } from '@workspace/ui/components/combobox'
import { cn } from '@workspace/ui/lib/utils'
import { referenceQueries } from './api'
import { institutionTypeOptions } from './options'

/** The chosen institution types, in the order picked, and which one is primary (C138). */
export type InstitutionTypesValue = { codes: string[]; primary: string | null }

type Props = {
  value: InstitutionTypesValue
  onValueChange: (value: InstitutionTypesValue) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}

/** Keeps the primary among the chosen: the first one picked, until another is marked. */
export function withPrimary(codes: string[], primary: string | null): InstitutionTypesValue {
  return { codes, primary: primary && codes.includes(primary) ? primary : (codes[0] ?? null) }
}

/**
 * Picks one or more institution types, grouped by sector; with more than one, asks which is the
 * primary. A tenant has exactly one primary type, and its sector follows from it.
 */
export function InstitutionTypesField({ value, onValueChange, placeholder = 'Search institution types', disabled, ...rest }: Props) {
  const { data, isPending, isError } = useQuery(referenceQueries.institutionTypes())
  const options = data ? institutionTypeOptions(data) : []
  const name = (code: string) => options.find((o) => o.value === code)?.label ?? code
  return (
    <div className="flex flex-col gap-2">
      <ComboboxMultiField
        value={value.codes}
        onValueChange={(codes) => onValueChange(withPrimary(codes, value.primary))}
        options={options}
        placeholder={isPending ? 'Loading institution types…' : isError ? 'Institution types could not be loaded' : placeholder}
        emptyText="No institution type matches."
        disabled={disabled || !data}
        {...rest}
      />
      {value.codes.length > 1 && (
        <div role="radiogroup" aria-label="Primary institution type" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-caption text-faint">Primary</span>
          {value.codes.map((code) => {
            const on = value.primary === code
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => onValueChange({ ...value, primary: code })}
                className={cn(
                  'h-[26px] rounded-full px-2.5 text-fine font-bold outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'bg-sage text-sage-foreground' : 'text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-surface-soft'
                )}
              >
                {name(code)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
