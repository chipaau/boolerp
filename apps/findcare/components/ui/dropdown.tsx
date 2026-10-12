'use client'

import type { ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@workspace/ui/components/select'
import { cn } from '@workspace/ui/lib/utils'

export type DropdownOption = { value: string; label: string; dot?: string }

const TRIGGER = {
  // a white pill with a soft shadow: the search bar's location and date pickers
  soft: 'bg-white shadow-soft',
  outline: 'bg-white shadow-[inset_0_0_0_1px_rgba(30,10,24,.1)]',
  ghost: 'bg-transparent',
  // a filter chip: glass at rest, solid indigo once something other than "any" is chosen
  chip: 'bg-glass shadow-[inset_0_0_0_1px_rgba(30,10,24,.08)] data-[active=true]:bg-indigo-900 data-[active=true]:text-white data-[active=true]:shadow-none',
} as const

/**
 * Pick one of a short list. The shared Select (keyboard, focus, positioning) in FindCare's dress: a
 * pill trigger with an optional leading icon, a rounded popover, the check on the right.
 */
export function Dropdown({
  options,
  value,
  onChange,
  label,
  icon,
  variant = 'soft',
  size = 'md',
  className,
}: {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  /** What the control chooses, for screen readers ("Location"). */
  label: string
  icon?: ReactNode
  variant?: keyof typeof TRIGGER
  size?: 'sm' | 'md'
  className?: string
}) {
  const selected = options.find((o) => o.value === value)
  const active = variant === 'chip' && !!value && value !== 'any' && value !== 'all'
  return (
    <Select value={value} onValueChange={(v) => v != null && onChange(String(v))}>
      <SelectTrigger
        aria-label={label}
        data-active={active}
        className={cn(
          // the shared trigger fills its row; a FindCare dropdown is a pill sized to its label
          'w-auto gap-2 rounded-full font-medium text-ink-900 [&_svg]:text-ink-900/60 data-[active=true]:[&_svg]:text-white/70',
          size === 'sm' ? 'h-8 pr-2.5 pl-3 text-[12.5px]' : 'h-[46px] pr-3.5 pl-4 text-[13px]',
          TRIGGER[variant],
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && <span className={cn('shrink-0', active ? 'text-white' : 'text-indigo-500')}>{icon}</span>}
          <span className="truncate">{selected?.label ?? label}</span>
        </span>
      </SelectTrigger>
      <SelectContent className="max-h-80 min-w-[max(var(--anchor-width),210px)] rounded-[18px] bg-white/98 p-1.5 shadow-popover">
        {options.map((o) => (
          <SelectItem
            key={o.value}
            value={o.value}
            className="min-h-[38px] rounded-xl py-0 pr-9 pl-3 text-[13px] font-normal text-ink-900 data-highlighted:bg-wash-2 data-selected:bg-indigo-50 data-selected:font-semibold [&>span:first-child]:right-3 [&>span:first-child]:left-auto [&>span:first-child_svg]:text-indigo-900"
          >
            <span className="flex items-center gap-2.5">
              {o.dot && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: o.dot }} />}
              {o.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
