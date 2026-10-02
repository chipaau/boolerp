// The contract between the workspace shell (apps/app) and the apps it hosts (HRMS, Tasks,
// Inventory, …), C102. Each app is its own package and describes itself once, with defineApp:
// the shell builds its app grid, switcher, sidebar and route guards from these manifests, and
// mounts each app's routes under its path (TanStack Router virtual file routes).
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

export type AppMenuItem = {
  title: string
  slug: string // empty string = the app home
  icon?: LucideIcon
  /**
   * Shows a live count at the right edge, read from the shell's nav counts under `key`;
   * `tone` colours it (plain by default). A manifest never holds numbers.
   */
  badge?: { key: string; tone?: 'risk' | 'warning' }
  /** Search params the link carries (saved views preset a filter / query). */
  search?: Record<string, string>
  /**
   * The permission the page needs, such as 'inventory:item:view'. Required for app packages
   * (defineApp); enforced when authorization exists (roadmap step 8), and always again by the API.
   */
  permission?: string
}
export type AppMenuSection = { title?: string; items: AppMenuItem[] }

/** An app as the shell sees it. */
export type AppDef = {
  /** URL segment and id: the app lives at /<slug>. */
  slug: string
  name: string
  description: string
  icon: LucideIcon
  menu: AppMenuSection[]
  /**
   * A rail that is more than a menu (counts, attention, toggles). The shell's sidebar renders it
   * under the app's header in place of the menu groups, built from the shared WorkspaceSidebar
   * pieces.
   */
  rail?: ComponentType<{ app: AppDef }>
}

type PermittedItem = AppMenuItem & { permission: string }
type PermittedApp = Omit<AppDef, 'menu'> & {
  menu: { title?: string; items: PermittedItem[] }[]
}

/**
 * Declares an app package's manifest. Every menu entry must name the permission its page needs,
 * so the menu and the route guard read one declaration (fail closed: no permission, no page).
 */
export function defineApp(app: PermittedApp): AppDef {
  return app
}

/** The menu entry for a section of an app ('' = home), if the app has one. */
export function findMenuItem(app: AppDef, section: string): AppMenuItem | undefined {
  return app.menu.flatMap((s) => s.items).find((i) => i.slug === section)
}
