import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { cn } from '@workspace/ui/lib/utils'
import { awayInfo, unitTone } from '@/features/org/logic'
import { usePeople, useUnits } from '@/features/org/queries'
import type { Person, Tone, Unit } from '@/features/org/types'

export const TONE_FALLBACK: Record<Tone, string> = {
  success: 'bg-tone-success-soft text-tone-success-foreground',
  warning: 'bg-tone-warning-soft text-tone-warning-foreground',
  danger: 'bg-tone-danger-soft text-tone-danger-foreground',
  plum: 'bg-tone-plum-soft text-tone-plum-foreground',
  slate: 'bg-tone-slate-soft text-tone-slate-foreground',
  neutral: 'bg-tone-neutral-soft text-tone-neutral-foreground',
  rose: 'bg-tone-rose-soft text-tone-rose-foreground',
  risk: 'bg-tone-risk-soft text-tone-risk-foreground',
  tan: 'bg-tone-tan-soft text-tone-tan-foreground',
}

export function useUnitsMap() {
  const list = useUnits()
  return Object.fromEntries(list.map((u) => [u.id, u])) as Partial<Record<string, Unit>>
}
export function usePeopleMap() {
  const list = usePeople()
  return Object.fromEntries(list.map((p) => [p.id, p])) as Partial<Record<string, Person>>
}

/** A person's photo, or their initials on their unit's tint. */
export function PersonAvatar({ person, units, className, fallbackClassName }: { person: Person | undefined; units?: Unit[]; className?: string; fallbackClassName?: string }) {
  const tone = units && person ? unitTone(units, person.unitId) : 'neutral'
  return (
    <Avatar name={person?.name ?? '?'} className={cn('size-8', className)}>
      {person?.photo && <AvatarImage src={person.photo} alt="" />}
      <AvatarFallback className={cn('text-micro', TONE_FALLBACK[tone], fallbackClassName)} />
    </Avatar>
  )
}

/** "Back 12 Sep" now, "Away 20 Sep" soon, or nothing. */
export function AwayBadge({ person, today, quiet = false }: { person: Person; today: Date; quiet?: boolean }) {
  const a = awayInfo(person, today)
  if (!a) return quiet ? null : <span className="text-caption text-faint">Available</span>
  return (
    <Badge variant={a.now ? 'warning' : 'neutral'} size="sm">
      {a.short}
    </Badge>
  )
}

export function copyText(text: string) {
  try {
    void navigator.clipboard.writeText(text)
  } catch {
    // clipboard access is best effort in the prototype
  }
}
