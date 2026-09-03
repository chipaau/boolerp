import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@workspace/ui/components/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@workspace/ui/components/tooltip'
import { SCHEDULE } from './data'
import { MeetingMarker } from './markers'

// Today's meetings: marker, time range (14 medium), and who is attending. Hovering a time warms
// the marker and turns it tan, bold and underlined; hovering "+n" lists the other attendees.
export function Schedule() {
  return (
    <TooltipProvider delay={150}>
      <ul className="space-y-3">
        {SCHEDULE.map((item) => (
          <li key={item.id} className="flex items-center gap-4">
            <button
              type="button"
              className="group flex items-center gap-2.5 rounded-sm text-sm font-medium text-foreground outline-none transition-colors duration-instant ease-hexa hover:font-bold hover:text-schedule-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <MeetingMarker size={20} className="group-hover:text-marker-meeting-hover" />
              <span className="tabular-nums decoration-schedule-hover decoration-1 underline-offset-[5px] group-hover:underline">
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
              {item.others && item.others.length > 0 && (
                <Tooltip>
                  <TooltipTrigger
                    className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${item.others.length} more attendees`}
                  >
                    <AvatarGroupCount className="size-7 bg-avatar-count text-[10px] text-foreground ring-card/60">
                      +{item.others.length}
                    </AvatarGroupCount>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" sideOffset={6}>
                    <ul className="space-y-0.5 text-left">
                      {item.others.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              )}
            </AvatarGroup>
          </li>
        ))}
      </ul>
    </TooltipProvider>
  )
}
