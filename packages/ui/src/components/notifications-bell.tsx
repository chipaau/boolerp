import type { ReactElement, ReactNode } from "react"
import { Bell } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { HexGlyph } from "@workspace/ui/components/hex-glyph"
import { cn } from "@workspace/ui/lib/utils"

/** One row in the bell dropdown. `category` shows as a neutral tag when given. */
export type NotificationsBellItem = {
  id: string
  title: ReactNode
  time?: ReactNode
  category?: string
  unread: boolean
}

/**
 * The header bell: an unread dot on the trigger and a dropdown of the most recent items. Presentational;
 * the app supplies the items, how each row links (`renderItem`, e.g. a router Link), the mark-all-read
 * callback, and optional "See all" / "Preferences" link elements for the footer.
 */
export function NotificationsBell<T extends NotificationsBellItem>({
  items,
  limit = 3,
  onMarkAllRead,
  onItemClick,
  renderItem,
  seeAll,
  preferences,
  emptyText = "Nothing new",
  showCategory = true,
}: {
  items: T[]
  /** How many rows the dropdown lists. */
  limit?: number
  onMarkAllRead: () => void
  onItemClick?: (item: T) => void
  /** The element each row renders as (e.g. `<Link to=… />`). */
  renderItem?: (item: T) => ReactElement
  seeAll?: ReactElement
  preferences?: ReactElement
  emptyText?: string
  /** Show each item's category tag beside its time. */
  showCategory?: boolean
}) {
  const hasUnread = items.some((n) => n.unread)
  const recent = items.slice(0, limit)
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
        {hasUnread && <span aria-hidden="true" data-slot="unread-dot" className="absolute top-1.5 right-[7px] size-[7px] rounded-full bg-tone-danger" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between px-3 pt-1 pb-2.5">
          <span className="text-overline text-faint">Notifications</span>
          <Button variant="link" size="xs" className="text-xs no-underline hover:underline" onClick={onMarkAllRead}>
            Mark all read
          </Button>
        </div>
        <DropdownMenuGroup>
          {recent.length === 0 && <p className="px-3 py-[11px] text-compact text-faint">{emptyText}</p>}
          {recent.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="items-start gap-[11px] rounded-[9px] px-3 py-[11px]"
              render={renderItem?.(n)}
              onClick={() => onItemClick?.(n)}
            >
              <HexGlyph size={10} className={cn("mt-1 shrink-0", n.unread ? "text-brand-soft" : "text-border")} />
              <span className="min-w-0 flex-1">
                <span className="block text-compact leading-[1.4] font-bold text-foreground">{n.title}</span>
                {((showCategory && n.category) || n.time) && (
                  <span className="mt-[3px] flex items-center gap-2 text-fine text-faint">
                    {showCategory && n.category && (
                      <Badge variant="secondary" size="sm">
                        {n.category}
                      </Badge>
                    )}
                    {n.time}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {(seeAll || preferences) && (
          <div className="mt-1.5 flex items-center justify-between border-t border-divider px-1 pt-2.5">
            {seeAll ? (
              <Button variant="link" size="xs" className="text-meta no-underline hover:underline" render={seeAll}>
                See all notifications
              </Button>
            ) : (
              <span />
            )}
            {preferences && (
              <Button variant="link" size="xs" className="text-meta text-muted-foreground no-underline hover:underline" render={preferences}>
                Preferences
              </Button>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
