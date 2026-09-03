import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { HexGlyph } from '@workspace/ui/components/hex-glyph'
import { cn } from '@workspace/ui/lib/utils'
import { useNotifications } from '@/features/shell/queries'

/** The bell with its unread dot and the notifications dropdown from the design. */
export function NotificationsMenu() {
  const notifications = useNotifications()
  const [read, setRead] = useState(false)
  const hasUnread = !read && notifications.some((n) => n.unread)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative size-[34px] text-muted-foreground hover:bg-sidebar-hover data-open:bg-sidebar-hover"
            aria-label="Notifications"
          />
        }
      >
        <Bell className="size-[17px]" strokeWidth={1.6} />
        {hasUnread && <span aria-hidden="true" className="absolute top-1.5 right-[7px] size-[7px] rounded-full bg-tone-danger" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between px-3 pt-1 pb-2.5">
          <span className="text-overline text-faint">Notifications</span>
          <Button variant="link" size="xs" className="text-xs no-underline hover:underline" onClick={() => setRead(true)}>
            Mark all read
          </Button>
        </div>
        <DropdownMenuGroup>
          {notifications.map((n) => (
            <DropdownMenuItem key={n.id} className="items-start gap-[11px] rounded-[9px] px-3 py-[11px]" onClick={() => setRead(true)}>
              <HexGlyph size={10} className={cn('mt-1 shrink-0', n.unread && !read ? 'text-brand-soft' : 'text-border')} />
              <span className="min-w-0 flex-1">
                <span className="block text-compact leading-[1.4] font-bold text-foreground">{n.text}</span>
                <span className="mt-[3px] block text-fine text-faint">{n.time}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <div className="mt-1.5 border-t border-divider pt-2.5 text-center">
          <Button variant="link" size="xs" className="text-meta no-underline hover:underline">
            See all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
