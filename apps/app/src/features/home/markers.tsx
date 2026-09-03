import { Check } from 'lucide-react'
import { Hexagon } from '@workspace/ui/components/hexagon'
import { cn } from '@workspace/ui/lib/utils'

// The three day markers used beside times and in the heat-map day card. Fills and the thin
// outline come from the --marker-* tokens so light and dark stay in step.

/** The "Calendar time" square from the design: 17px, 5px corners, peach fill, ink outline at 67%. */
export function MeetingMarker({ size = 17, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        'grid shrink-0 place-items-center rounded-[5px] bg-marker-meeting text-marker-outline shadow-[inset_0_0_0_1.2px_color-mix(in_srgb,var(--marker-outline)_67%,transparent)]',
        className
      )}
    >
      <Check style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.75} />
    </span>
  )
}

export function TaskMarker({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <Hexagon
      aria-hidden="true"
      size={size}
      gradient={['var(--marker-task-from)', 'var(--marker-task-to)']}
      stroke="var(--marker-outline)"
      strokeWidth={1}
      className={className}
    />
  )
}

export function ApprovalMarker({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <Hexagon
      aria-hidden="true"
      size={size}
      stroke="var(--marker-outline)"
      strokeWidth={1}
      className={cn('text-marker-approval', className)}
    />
  )
}

/** The small amber hexagon beside the date: the same gradient and outline as today on the map. */
export function TodayMarker({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <Hexagon
      aria-hidden="true"
      size={size}
      gradient={['var(--heat-today-from)', 'var(--heat-today-to)']}
      stroke="var(--heat-today-stroke)"
      strokeWidth={0.8}
      className={className}
    />
  )
}
