import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@workspace/ui/components/avatar'
import { SCHEDULE } from './data'
import { MeetingMarker } from './markers'

// Today's meetings: marker, time range (14 medium), and who is attending. Hovering a row warms
// the marker and turns the time tan, bold and underlined, as in the design.
export function Schedule() {
  return (
    <ul className="space-y-3">
      {SCHEDULE.map((item) => (
        <li key={item.id} className="flex items-center gap-4">
          <button
            type="button"
            className="group flex items-center gap-2.5 rounded-sm text-sm font-medium text-foreground outline-none transition-colors duration-instant ease-hexa hover:font-bold hover:text-schedule-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MeetingMarker size={17} className="transition-colors duration-instant ease-hexa group-hover:bg-marker-meeting-hover" />
            <span className="tabular-nums decoration-schedule-hover decoration-[1.5px] underline-offset-[5px] group-hover:underline">
              {item.start} - {item.end}
            </span>
          </button>
          <AvatarGroup className="ms-5 -space-x-2">
            {item.people.map((p) => (
              <Avatar key={p.name} name={p.name} className="size-7" title={p.name}>
                {p.photo && <AvatarImage src={p.photo} alt="" />}
                <AvatarFallback className="text-[10px]" />
              </Avatar>
            ))}
            {item.extra && (
              <AvatarGroupCount className="size-7 bg-avatar-count text-[10px] text-foreground ring-card/60">
                +{item.extra}
              </AvatarGroupCount>
            )}
          </AvatarGroup>
        </li>
      ))}
    </ul>
  )
}
