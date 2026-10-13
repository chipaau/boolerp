// UI fixtures — marketing content for the homepage, not live data
import { Box, ChartNoAxesColumn, ListChecks, ShoppingCart } from 'lucide-react'

/** The apps named under the calls to action, two to a line: the workspace's main apps. */
export const HERO_APPS = [
  { icon: Box, name: 'Inventory', with: '& Assets' },
  { icon: ListChecks, name: 'Tasks', with: '& Notes' },
  { icon: ShoppingCart, name: 'Procurement', with: '& Orders' },
  { icon: ChartNoAxesColumn, name: 'Analytics', with: '& Reports' },
]
