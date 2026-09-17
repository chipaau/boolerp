import type { LinkProps } from '@tanstack/react-router'

/**
 * Link/navigate options for a path (and search) that may not be in the generated route union yet —
 * the console's screens are built in parallel, so a typed `to` would fail until every route exists.
 */
export const routeLink = (to: string, search?: Record<string, string>, params?: Record<string, string>) =>
  ({ to, search, params }) as unknown as LinkProps
