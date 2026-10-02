import { Link } from '@tanstack/react-router'
import { NotificationsBell } from '@workspace/ui/components/notifications-bell'
import { useMyNotifications } from '@/features/notifications/queries'
import { useMarkAllRead } from '@/features/shell/queries'

/** The shared bell fed with my notifications; the page has them all, the bell the three most recent. */
export function NotificationsMenu() {
  const notifications = useMyNotifications()
  const markAllRead = useMarkAllRead()
  return (
    <NotificationsBell
      items={notifications}
      showCategory={false}
      onMarkAllRead={() => markAllRead.mutate()}
      onItemClick={() => markAllRead.mutate()}
      renderItem={(n) => <Link to="/$app/$section" params={{ app: n.to.app, section: n.to.section ?? '' }} search={{ id: n.to.id }} />}
      seeAll={<Link to="/notifications" />}
      preferences={<Link to="/notifications/preferences" />}
    />
  )
}
