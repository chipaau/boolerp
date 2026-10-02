import { createFileRoute } from '@tanstack/react-router'
import { NotificationsPage } from '@/features/shell/notifications-page'

// Every notification across apps ("See all notifications" from the bell). A shell page: it sits
// inside the signed-in layout but belongs to no single app, so there is no rail.
export const Route = createFileRoute('/_app/notifications')({
  component: NotificationsPage,
})
