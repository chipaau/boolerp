import { Hexagon } from '@workspace/ui/components/hexagon'
import { cn } from '@workspace/ui/lib/utils'

// The day markers used beside times and in the heat-map day card. Fills and the thin outline
// come from the --marker-* tokens so light and dark stay in step.

/**
 * The "Calendar time" icon from the design export (packages/assets/icons/calendar-time.svg),
 * inlined so its fill can follow hover/theme: a 17px squircle with the ink outline at 67% and a
 * small check inside.
 */
export function MeetingMarker({ size = 17, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 17 17"
      fill="none"
      className={cn('shrink-0 text-marker-meeting transition-colors duration-instant ease-hexa', className)}
    >
      <path
        d="M0.5 8.41667C0.5 4.68472 0.5 2.81874 1.65937 1.65937C2.81874 0.5 4.68472 0.5 8.41667 0.5C12.1486 0.5 14.0146 0.5 15.174 1.65937C16.3333 2.81874 16.3333 4.68472 16.3333 8.41667C16.3333 12.1486 16.3333 14.0146 15.174 15.174C14.0146 16.3333 12.1486 16.3333 8.41667 16.3333C4.68472 16.3333 2.81874 16.3333 1.65937 15.174C0.5 14.0146 0.5 12.1486 0.5 8.41667Z"
        fill="currentColor"
        stroke="var(--marker-outline)"
        strokeOpacity="0.67"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M5.6 8.3l2 2 3.6-3.8"
        stroke="var(--marker-outline)"
        strokeOpacity="0.85"
        strokeWidth="1.3"
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
