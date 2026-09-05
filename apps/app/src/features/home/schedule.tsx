import { Link } from '@tanstack/react-router'
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@workspace/ui/components/avatar'
import { MapPin } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@workspace/ui/components/tooltip'
import { useSchedule } from './queries'
import { MeetingMarker } from './markers'
import type { ScheduleItem } from './types'

/** The hover card for one meeting: what, when, where, who. Clicking the time opens the meeting. */
function MeetingCard({ item }: { item: ScheduleItem }) {
  const names = [...item.people.map((p) => p.name), ...(item.others ?? [])]
  return (
    <div className="w-64 space-y-3 p-1">
      <div className="min-w-0">
        <div className="text-ui-lg leading-[1.35] font-bold text-foreground">{item.title}</div>
        <div className="mt-0.5 text-ui-lg text-faint">
          {item.start} – {item.end}
        </div>
      </div>
      <div className="flex items-center gap-2.5 text-sm text-foreground">
        <MapPin className="size-4 shrink-0 text-faint" strokeWidth={1.6} />
        <span className="min-w-0 truncate">{item.location}</span>
      </div>
      <div className="text-caption text-muted-foreground">
        {names.length} attending · {names.slice(0, 3).join(', ')}
        {names.length > 3 ? ` and ${names.length - 3} more` : ''}
      </div>
    </div>
  )
}

// Today's meetings: marker, time range (14 medium), and who is attending. Hovering a time warms
// the marker, turns it tan, bold and underlined, and opens the meeting card (what, where, who);
// hovering "+n" lists the other attendees.
export function Schedule() {
  const schedule = useSchedule()
  return (
    <TooltipProvider delay={150}>
      <ul className="space-y-3">
        {schedule.length === 0 && <li className="text-sm text-muted-foreground">Nothing else today.</li>}
        {schedule.map((item) => (
          <li key={item.id} className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger
                render={<Link to="/$app/$section" params={{ app: 'calendar', section: 'meetings' }} search={{ id: item.meetingId }} />}
                className="group flex items-center gap-2.5 rounded-sm text-sm font-medium text-foreground outline-none transition-colors duration-instant ease-hexa hover:font-bold hover:text-schedule-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`${item.title}, ${item.start} to ${item.end}. Open the meeting`}
              >
                <MeetingMarker size={18} className="group-hover:text-marker-meeting-hover" />
                <span className="tabular-nums decoration-schedule-hover decoration-1 underline-offset-[5px] group-hover:underline">
                  {item.start} - {item.end}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={8} variant="card" showArrow={false}>
                <MeetingCard item={item} />
              </TooltipContent>
            </Tooltip>
            <AvatarGroup className="ms-5 -space-x-2">
              {item.people.map((p) => (
                <Tooltip key={p.name}>
                  <TooltipTrigger
                    className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={p.name}
                  >
                    <Avatar name={p.name} className="size-7">
                      {p.photo && <AvatarImage src={p.photo} alt="" />}
                      <AvatarFallback className="text-[10px]" />
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    {p.name}
                  </TooltipContent>
                </Tooltip>
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
