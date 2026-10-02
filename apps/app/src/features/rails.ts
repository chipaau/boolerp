import type { ComponentType } from 'react'
import { CalendarRail } from './calendar/calendar-rail'
import { DirectoryRail } from './directory/directory-rail'
import type { AppDef } from '@workspace/app-kit'

/**
 * Prototype apps whose rail is more than a menu (Calendar: mini month, awaiting replies, calendar toggles)
 * register a rail component here; the sidebar renders it under the app's identity header in
 * place of the registry's menu groups. Rails return the shared WorkspaceSidebar pieces
 * (SidebarNavGroups, SidebarSection, SidebarAttention), never their own row markup.
 */
export const RAILS: Partial<Record<string, ComponentType<{ app: AppDef }>>> = {
  calendar: CalendarRail,
  directory: DirectoryRail,
}

/** The app's rail: an app package brings its own in its manifest (C102), prototypes register here. */
export function getRail(app: AppDef) {
  return app.rail ?? RAILS[app.slug]
}
