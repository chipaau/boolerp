import { Activity, Baby, Ear, HeartPulse, Smile, Sparkles, Stethoscope, Syringe, TestTube } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// The icon each specialty carries (its `icon` field), as Lucide line icons.
const ICONS: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  baby: Baby,
  sparkles: Sparkles,
  ear: Ear,
  'heart-pulse': HeartPulse,
  smile: Smile,
  activity: Activity,
  'test-tube': TestTube,
  syringe: Syringe,
}

export function SpecialtyIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (ICONS as Partial<Record<string, LucideIcon>>)[name] ?? Stethoscope
  return <Icon aria-hidden className={className ?? 'size-4'} strokeWidth={1.7} />
}
