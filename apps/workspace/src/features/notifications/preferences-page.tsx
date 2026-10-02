import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Switch } from '@workspace/ui/components/switch'
import { useToast } from '@workspace/ui/components/toast'
import { PageTitle } from '@workspace/ui/components/page'
import { notificationRulesQuery } from '@workspace/org/queries'
import type { NotificationCategory } from '@/features/shell/types'
import { NOTIFICATION_CATEGORIES, categoryForEvent } from './logic'
import { useNotificationPreferenceActions, useNotificationPreferences } from './queries'
import type { NotificationChannel } from './types'

const GRID = 'grid grid-cols-[minmax(0,1fr)_72px_72px_72px] items-center gap-3 px-[22px]'
const CHANNEL_LABEL: Record<NotificationChannel, string> = { inApp: 'in-app', email: 'email' }

/**
 * "My notifications": one row per category with in-app and email switches that narrow what the
 * organisation sends; a category with no personal row follows the organisation. Below, the
 * events that are always delivered, locked.
 */
export function NotificationPreferencesPage() {
  const prefs = useNotificationPreferences()
  const rules = useQuery(notificationRulesQuery()).data ?? []
  const actions = useNotificationPreferenceActions()
  const toast = useToast()
  const mandatory = rules.filter((r) => r.mandatory)

  const set = (category: NotificationCategory, channel: NotificationChannel, on: boolean) => {
    const undo = actions.set(category, channel, on)
    toast(`${category} ${CHANNEL_LABEL[channel]} turned ${on ? 'on' : 'off'}`, { undo })
  }
  const reset = (category: NotificationCategory) => {
    const undo = actions.reset(category)
    toast(`${category} follows your organisation again`, { undo })
  }

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="mx-auto max-w-[1040px] px-12 pt-10 pb-28">
        <PageTitle
          className="mb-[26px]"
          overline={
            <Link to="/notifications" className="hover:text-foreground">
              Notifications
            </Link>
          }
          title="My notifications"
          meta={<span>Choose what reaches you. You can only turn off what your organisation sends.</span>}
        />

        <Card className="mb-[18px] gap-0 overflow-clip py-0">
          <div className={`${GRID} border-b border-divider py-[11px] text-overline text-faint`}>
            <span>Category</span>
            <span className="text-center">In-app</span>
            <span className="text-center">Email</span>
            <span />
          </div>
          {NOTIFICATION_CATEGORIES.map(({ category, description }) => {
            const pref = prefs.find((p) => p.category === category)
            return (
              <div key={category} className={`${GRID} border-b border-divider py-4 last:border-b-0`}>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground">{category}</span>
                  <span className="mt-1 block text-meta text-muted-foreground">{description}</span>
                  <span className="mt-1 block text-caption text-faint">{pref ? `Your choice · changed ${pref.updatedOn}` : 'Following your organisation'}</span>
                </span>
                <Switch className="justify-self-center" checked={pref ? pref.inApp : true} onCheckedChange={(on) => set(category, 'inApp', on)} aria-label={`${category} in-app`} />
                <Switch className="justify-self-center" checked={pref ? pref.email : true} onCheckedChange={(on) => set(category, 'email', on)} aria-label={`${category} email`} />
                <span className="justify-self-end">
                  {pref && (
                    <Button variant="link" size="xs" className="text-meta" onClick={() => reset(category)}>
                      Reset
                    </Button>
                  )}
                </span>
              </div>
            )
          })}
        </Card>

        {mandatory.length > 0 && (
          <section>
            <div className="mb-2.5 ml-0.5 text-overline text-faint">Always delivered</div>
            <Card className="gap-0 overflow-clip py-0">
              {mandatory.map((r) => (
                <div key={r.id} className={`${GRID} border-b border-divider py-4 last:border-b-0`}>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
                      <Lock className="size-3.5 text-faint" strokeWidth={1.8} aria-hidden="true" />
                      {r.event}
                      <Badge variant="neutral" size="sm">
                        {categoryForEvent(r.eventKey)}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-meta text-muted-foreground">Critical for security, access or money, so your organisation delivers it to everyone it concerns.</span>
                  </span>
                  <Switch className="justify-self-center" checked={r.inApp} disabled aria-label={`${r.event} in-app, always delivered`} />
                  <Switch className="justify-self-center" checked={r.email} disabled aria-label={`${r.event} email, always delivered`} />
                  <span />
                </div>
              ))}
            </Card>
          </section>
        )}
      </div>
    </div>
  )
}
