import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@workspace/ui/lib/utils'

// Anything tappable is a pill. One action colour: primary is indigo, with a tracked uppercase label
// (JOIN WAITLIST, DIRECTIONS), as is outline; the quieter variants use sentence case.

const VARIANT = {
  primary: 'bg-indigo-900 text-white hover:bg-indigo-950 cta-label',
  outline: 'bg-transparent text-ink-900 shadow-outline hover-outline cta-label',
  soft: 'bg-white text-ink-900 hover:bg-indigo-50 text-[12.5px] font-medium',
  ghost: 'bg-transparent text-ink-900 hover-ghost text-[12.5px] font-medium',
  danger: 'bg-transparent text-danger hover:text-danger-hover px-3.5 text-[12.5px] font-medium',
  dangerSolid: 'bg-danger text-white hover:bg-danger-hover cta-label',
} as const

const SIZE = { lg: 'h-[46px] px-6', md: 'h-[38px] px-[18px]', sm: 'h-[34px] px-3.5 [&.cta-label]:text-[10.5px] [&.cta-label]:tracking-[0.16em]' } as const

export type ButtonVariant = keyof typeof VARIANT

type Style = { variant?: ButtonVariant; size?: keyof typeof SIZE }

export const buttonClass = ({ variant = 'primary', size = 'md' }: Style = {}, className?: string) =>
  cn(
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-[7px] rounded-full whitespace-nowrap no-underline transition-[background-color,box-shadow,color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45',
    VARIANT[variant],
    SIZE[size],
    className,
  )

export function Button({ variant, size, className, type = 'button', ...props }: ComponentProps<'button'> & Style) {
  return <button type={type} className={buttonClass({ variant, size }, className)} {...props} />
}

/** A button that navigates. */
export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & Style & { children: ReactNode }) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />
}
