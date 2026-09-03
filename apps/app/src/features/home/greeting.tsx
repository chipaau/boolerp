import { useCurrentUser } from '@/components/layout/user-context'
import { STATS } from './data'
import { TodayMarker } from './markers'

function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// Overline date, the greeting (Heading 1, regular), and the three headline counters
// (26 medium / 16 regular; Lato has no 500, so medium renders as 400 per the type rules).
export function Greeting({ today }: { today: Date }) {
  const user = useCurrentUser()
  const firstName = user.name.split(' ')[0]
  const weekday = today.toLocaleDateString('en-GB', { weekday: 'long' })
  const monthDay = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return (
    <div className="space-y-8">
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-overline uppercase text-faint">
          <TodayMarker size={14} />
          <span>
            {weekday} · {monthDay} ·
          </span>
        </div>
        <h1 className="text-h1 leading-[1.2] tracking-[-0.01em] text-foreground">
          {greetingFor(today.getHours())}, {firstName}.
        </h1>
      </div>

      <dl className="flex divide-x divide-border">
        {STATS.map((s) => (
          <div key={s.label} className="pe-7 not-first:ps-7">
            <dd className="text-[22px] leading-none font-medium tabular-nums text-foreground">{s.value}</dd>
            <dt className="mt-1.5 text-sm text-muted-foreground">{s.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  )
}
