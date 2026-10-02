import { createFileRoute } from '@tanstack/react-router'
import { NotificationPreferencesPage } from '@/features/notifications/preferences-page'

// My notification preferences, reached from the bell and the Notifications page. A shell page
// beside /notifications (not nested in it), so it has its own screen.
export const Route = createFileRoute('/_app/notifications_/preferences')({
  component: NotificationPreferencesPage,
})
