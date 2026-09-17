import type { ComponentType } from 'react'
import { CalendarPage } from './calendar/calendar-page'
import { MeetingDetailPage } from './calendar/meeting-detail-page'
import { EmployeesPage } from './control-centre/employees-page'
import { ControlOverviewPage } from './control-centre/overview-page'
import { SiteTypesPage } from './control-centre/site-types-page'
import { SitesPage } from './control-centre/sites-page'
import { ActivityPage } from './control-centre/activity-page'
import { ApprovalsPage } from './control-centre/approvals-page'
import { CodesPage } from './control-centre/codes-page'
import { HolidaysPage } from './control-centre/holidays-page'
import { NotificationRulesPage } from './control-centre/notifications-rules-page'
import { RegionsPage } from './control-centre/regions-page'
import { UnitsPage } from './control-centre/units-page'
import { OrgPage } from './directory/org-page'
import { PeoplePage } from './directory/people-page'
import { InventoryItemsPage } from './inventory/items-page'
import { InventoryOverviewPage } from './inventory/overview-page'

/**
 * Real screens, keyed by app slug and section slug ('' = the app home). The `$app` routes look
 * here first and fall back to the prototype page, so replacing a placeholder is one line.
 */
export const SCREENS: Partial<Record<string, Partial<Record<string, ComponentType>>>> = {
  inventory: {
    '': InventoryOverviewPage,
    items: InventoryItemsPage,
  },
  calendar: {
    '': CalendarPage,
    meetings: MeetingDetailPage, // /calendar/meetings?id=…
  },
  'control-centre': {
    '': ControlOverviewPage,
    units: UnitsPage, // ?id=<unit>
    'site-types': SiteTypesPage, // ?id=<type>
    sites: SitesPage, // ?id=<site>; ?filter=Paused|Active|new:<type>
    employees: EmployeesPage, // ?id=<person> opens the record; ?filter=<status>|no-site|new:<unit>
    approvals: ApprovalsPage,
    codes: CodesPage,
    regions: RegionsPage,
    holidays: HolidaysPage,
    notifications: NotificationRulesPage,
    activity: ActivityPage,
  },
  directory: {
    '': PeoplePage, // ?scope=group:<unit>|mgr:<person>|away&sort=team&q=&id=<person>
    org: OrgPage, // ?id=<person> reveals them in the chart
  },
}

export function getScreen(app: string, section: string): ComponentType | undefined {
  return SCREENS[app]?.[section]
}
