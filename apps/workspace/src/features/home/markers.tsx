import { Hexagon } from '@workspace/ui/components/hexagon'
import { cn } from '@workspace/ui/lib/utils'

// The day markers used beside times and in the heat-map day card. Fills, the thin outline and
// the clock detail come from the --marker-* tokens so light and dark stay in step.

/**
 * The "Calendar time" icon from the design export (packages/assets/icons/calendar-time.svg),
 * inlined so its fill can follow hover/theme: a squircle with the ink outline at 67% and two
 * clock hands. The viewBox is cropped to the shape, so `size` is the visible size of the
 * squircle (matching the hexagon markers beside it), not the export's 20px canvas.
 */
export function MeetingMarker({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="1.5 1.5 17 17"
      fill="none"
      style={{ width: size, height: size }}
      className={cn('block shrink-0 text-marker-meeting transition-colors duration-instant ease-bool', className)}
    >
      <path
        d="M2.08301 9.99992C2.08301 6.26797 2.08301 4.40199 3.24237 3.24262C4.40175 2.08325 6.26772 2.08325 9.99968 2.08325C13.7316 2.08325 15.5976 2.08325 16.757 3.24262C17.9163 4.40199 17.9163 6.26797 17.9163 9.99992C17.9163 13.7318 17.9163 15.5978 16.757 16.7573C15.5976 17.9166 13.7316 17.9166 9.99968 17.9166C6.26773 17.9166 4.40175 17.9166 3.24237 16.7573C2.08301 15.5978 2.08301 13.7318 2.08301 9.99992Z"
        fill="currentColor"
        stroke="var(--marker-outline)"
        strokeOpacity="0.67"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 7.49996L10.8334 10.833M13.3333 6.66663L9.16667 10.8333"
        stroke="var(--marker-detail)"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
