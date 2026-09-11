import type { ComponentType } from 'react'
import { CalendarRail } from './calendar/calendar-rail'
import { ControlRail } from './control-centre/control-rail'
import { DirectoryRail } from './directory/directory-rail'
import type { AppDef } from '@/lib/apps'

/**
 * Apps whose rail is more than a menu (Calendar: mini month, awaiting replies, calendar toggles)
 * register a rail component here; the sidebar renders it under the app's identity header in
 * place of the registry's menu groups.
 */
export const RAILS: Partial<Record<string, ComponentType<{ app: AppDef }>>> = {
  calendar: CalendarRail,
  'control-centre': ControlRail,
  directory: DirectoryRail,
}

export function getRail(app: string) {
  return RAILS[app]
}
