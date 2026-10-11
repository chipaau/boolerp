import { cn } from '@workspace/ui/lib/utils'
import type { Tint } from '@/lib/data'

// Tailwind needs the class names whole, so each tint's pair is spelled out.
export const TINT: Record<Tint, string> = {
  mint: 'bg-[var(--tint-mint-bg)] text-[var(--tint-mint-fg)]',
  peach: 'bg-[var(--tint-peach-bg)] text-[var(--tint-peach-fg)]',
  lilac: 'bg-[var(--tint-lilac-bg)] text-[var(--tint-lilac-fg)]',
  butter: 'bg-[var(--tint-butter-bg)] text-[var(--tint-butter-fg)]',
  sky: 'bg-[var(--tint-sky-bg)] text-[var(--tint-sky-fg)]',
  blue: 'bg-[var(--tint-blue-bg)] text-[var(--tint-blue-fg)]',
}

/** Initials on the specialty's tint; there are no photos by default. */
export function Avatar({ initials, tint = 'lilac', size = 48, className }: { initials: string; tint?: Tint; size?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[0.02em]', TINT[tint], className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
    >
      {initials}
    </div>
  )
}

/** Two initials from a name. */
export const initialsOf = (name: string) =>
  name
    .replace(/^Dr\.?\s+/, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
