import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Badge } from '@workspace/ui/components/badge'
import type { BadgeTone } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { HexGlyph } from '@workspace/ui/components/hex-glyph'
import { cn } from '@workspace/ui/lib/utils'
import { PageTitle } from '@/components/layout/page'
import { useMyNotifications } from '@/features/notifications/queries'
import { useMarkAllRead } from './queries'
import type { Notification, NotificationCategory, NotificationGroup } from './types'

const FILTERS = ['All', 'Unread', 'Meetings', 'Stock', 'Approvals', 'Orders', 'Setup'] as const
type Filter = (typeof FILTERS)[number]
const GROUPS: NotificationGroup[] = ['Today', 'Yesterday', 'Earlier']
const CATEGORY_TONE: Record<NotificationCategory, BadgeTone> = { Meetings: 'slate', Stock: 'risk', Approvals: 'warning', Orders: 'plum', Setup: 'neutral' }

function matches(n: Notification, f: Filter) {
  if (f === 'All') return true
  if (f === 'Unread') return n.unread
  return n.category === f
}

/**
 * All notifications, as the design lays them out: title with the unread count, Preferences and
 * Mark all read, a filter card, then one card per day group with hex marker, title + context, the
 * category pill and the time. Rows lead to the screen the event belongs to.
 */
export function NotificationsPage() {
  const notifications = useMyNotifications()
  const markAllRead = useMarkAllRead()
  const [filter, setFilter] = useState<Filter>('All')
  const unread = notifications.filter((n) => n.unread).length

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="mx-auto max-w-[1040px] px-12 pt-10 pb-28">
        <PageTitle
          className="mb-[26px]"
          title="Notifications"
          meta={<span>{unread ? `${unread} unread` : 'All caught up'} · meetings, stock, approvals, orders and setup</span>}
          actions={
            <>
              <Button variant="outline">Preferences</Button>
              <Button onClick={() => markAllRead.mutate()} disabled={unread === 0}>
                Mark all read
                <ButtonArrow />
              </Button>
            </>
          }
        />

        <Card className="mb-[18px] flex-row flex-wrap items-center gap-2 px-5 py-3.5">
          {FILTERS.map((f) => (
            <Badge key={f} variant={f === filter ? 'filter-active' : 'filter'} render={<button type="button" onClick={() => setFilter(f)} />}>
              {f}
            </Badge>
          ))}
        </Card>

        {GROUPS.map((group) => {
          const rows = notifications.filter((n) => n.group === group && matches(n, filter))
          if (rows.length === 0) return null
          return (
            <section key={group} className="mb-[18px]">
              <div className="mb-2.5 ml-0.5 text-overline text-faint">{group}</div>
              <Card className="gap-0 overflow-hidden py-0">
                <ul>
                  {rows.map((n) => (
                    <li key={n.id}>
                      <Link
                        to="/$app/$section"
                        params={{ app: n.to.app, section: n.to.section ?? '' }}
                        search={{ id: n.to.id }}
                        onClick={() => markAllRead.mutate()}
                        className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-start gap-3.5 border-b border-divider px-[22px] py-4 outline-none transition-colors duration-instant ease-bool hover:bg-surface-soft focus-visible:bg-surface-soft [li:last-child>&]:border-b-0"
                      >
                        <HexGlyph size={10} className={cn('mt-1', n.unread ? 'text-brand-soft' : 'text-border')} />
                        <span className="min-w-0">
                          <span className={cn('block text-sm text-foreground', n.unread && 'font-bold')}>{n.title}</span>
                          <span className="mt-1 block text-meta text-muted-foreground">{n.meta}{n.emailed && ' · Also emailed'}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <Badge variant={CATEGORY_TONE[n.category]} size="sm">
                            {n.category}
                          </Badge>
                          <span className="whitespace-nowrap text-xs text-faint">{n.time}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )
        })}

        <Card className="flex-row flex-wrap items-center justify-between gap-3 px-[22px] py-[18px]">
          <span className="text-compact text-muted-foreground">Notifications are kept for 90 days</span>
          <Button variant="link" size="sm" className="text-meta">
            Choose what reaches you
          </Button>
        </Card>
      </div>
    </div>
  )
}
