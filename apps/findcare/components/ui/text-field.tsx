import { useId } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'

const SIZE = { md: 'h-12', lg: 'h-[52px]' } as const

/**
 * A labelled text input: a tracked uppercase label (with an optional note on its right), a white
 * 14px-radius box with an optional fixed prefix (a country code), and an optional hint under it that
 * turns into the error message when there is one, so the reason is in text and read out with the
 * field, not only shown as the red ring. A form that explains the problem elsewhere (under its
 * button) marks the field `invalid` and points `aria-describedby` at that message.
 */
export function TextField({
  label,
  aside,
  prefix,
  hint,
  error,
  invalid,
  size = 'md',
  className,
  inputClassName,
  ...props
}: Omit<ComponentProps<'input'>, 'prefix' | 'size'> & {
  label: ReactNode
  aside?: ReactNode
  prefix?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  invalid?: boolean
  size?: keyof typeof SIZE
  inputClassName?: string
}) {
  const id = useId()
  const note = error || hint
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex items-baseline justify-between gap-2.5">
        <label htmlFor={id} className="eyebrow text-ink-500">
          {label}
        </label>
        {aside && <span className="text-[11.5px] text-ink-400">{aside}</span>}
      </div>
      <div
        className={cn(
          'flex items-center gap-3 rounded-[14px] bg-white px-4 focus-within:ring-2 focus-within:ring-indigo-500',
          SIZE[size],
          error || invalid ? 'shadow-[inset_0_0_0_1.5px_var(--danger)]' : 'shadow-[inset_0_0_0_1px_var(--line-3)]',
        )}
      >
        {prefix && (
          <>
            <span className="text-[15px] font-medium text-ink-700">{prefix}</span>
            <span aria-hidden className="h-5 w-px bg-line-3" />
          </>
        )}
        <input
          id={id}
          aria-invalid={!!(error || invalid) || undefined}
          aria-describedby={note ? `${id}-note` : undefined}
          className={cn('h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink-900 outline-none placeholder:text-ink-400', inputClassName)}
          {...props}
        />
      </div>
      {note && (
        <p id={`${id}-note`} className={cn('text-[12px] leading-normal', error ? 'text-danger' : 'text-ink-500')}>
          {note}
        </p>
      )}
    </div>
  )
}
