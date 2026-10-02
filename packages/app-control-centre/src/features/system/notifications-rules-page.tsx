import { useState } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Card } from '@workspace/ui/components/card'
import { Switch } from '@workspace/ui/components/switch'
import { useToast } from '@workspace/ui/components/toast'
import { recipientRoleLabel } from '@workspace/org/logic'
import { useNotificationRuleActions, useNotificationRules } from '@workspace/org/queries'
import { AppTabs } from './codes-page'
import { ControlTitle, RuleStrip, useCanEdit } from '../shared'

const GRID = 'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_78px_78px] items-center gap-3 px-5'

/** What the apps tell people about and through which channel; recipients resolve through the org tree. */
export function NotificationRulesPage() {
  const rules = useNotificationRules()
  const actions = useNotificationRuleActions()
  const canEdit = useCanEdit()
  const toast = useToast()
  const [app, setApp] = useState('all')
  const list = rules.filter((n) => app === 'all' || n.sourceApp === app)
  const both = rules.filter((n) => n.inApp && n.email).length
  const none = rules.filter((n) => !n.inApp && !n.email).length
  const toggle = (id: string, channel: 'inApp' | 'email') => (canEdit ? actions.toggle(id, channel) : toast('Read only as Staff — ask an Admin to change setup', { ok: false }))
  const required = rules.filter((n) => n.mandatory).length
  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle overline="System" title="Notifications" description="What the apps tell people about, and how it reaches them. Recipients resolve through the org tree — “site manager” means whoever holds that site today, so this keeps working when people change." />
        <RuleStrip>{both} go to both channels · {none} silenced · {required} required · recipients resolve live through the org tree</RuleStrip>
        <Card className="gap-0 overflow-clip py-0">
          <AppTabs value={app} onChange={setApp} count={`${list.length} of ${rules.length} events`} />
          <div className={`${GRID} border-b border-divider py-[11px] text-overline font-bold tracking-[0.1em] text-faint uppercase`}>
            <span>Event</span>
            <span>Goes to</span>
            <span className="text-center">In-app</span>
            <span className="text-center">Email</span>
          </div>
          {list.map((n) => (
            <div key={n.id} className={`${GRID} border-b border-divider py-3.5 last:border-b-0`}>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-ui-sm font-bold text-foreground">
                  {n.event}
                  {n.mandatory && (
                    <Badge variant="warning" size="sm" title="Critical — people can’t mute this">
                      Required
                    </Badge>
                  )}
                </span>
                <span className="mt-[3px] block text-caption text-faint">{n.sourceApp}</span>
              </span>
              <span className="flex min-w-0 flex-wrap gap-1.5">
                {n.recipientRoles.map((r) => (
                  <Badge key={r} variant="neutral" size="sm">
                    {recipientRoleLabel(r)}
                  </Badge>
                ))}
              </span>
              <Switch className="justify-self-center" checked={n.inApp} disabled={n.mandatory && n.inApp} onCheckedChange={() => toggle(n.id, 'inApp')} aria-label={`${n.event} in-app`} />
              <Switch className="justify-self-center" checked={n.email} disabled={n.mandatory && n.email} onCheckedChange={() => toggle(n.id, 'email')} aria-label={`${n.event} email`} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
