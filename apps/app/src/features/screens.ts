import type { ComponentType } from 'react'
import { InventoryItemsPage } from './inventory/items-page'
import { InventoryOverviewPage } from './inventory/overview-page'

/**
 * Real screens, keyed by app slug and section slug ('' = the app home). The `$app` routes look
 * here first and fall back to the prototype page, so replacing a placeholder is one line.
 */
export const SCREENS: Record<string, Record<string, ComponentType>> = {
  inventory: {
    '': InventoryOverviewPage,
    items: InventoryItemsPage,
  },
}

export function getScreen(app: string, section: string): ComponentType | undefined {
  return SCREENS[app]?.[section]
}
