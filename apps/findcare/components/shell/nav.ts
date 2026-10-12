import { CalendarDays, House, Search } from 'lucide-react'
import { useAccount } from '@/lib/data'
import { routes } from '@/lib/routes'

/**
 * The three places, shared by the header and the tab bar. My Care and Appointments need an account.
 * `fills`: the icon reads well filled in when selected; the others would turn into a solid block.
 */
export const NAV = [
  {
    id: 'find',
    label: 'Find care',
    icon: Search,
    fills: false,
    path: routes.find(),
    signedIn: false,
    match: (p: string) => p === '/' || p.startsWith('/doctors') || p.startsWith('/clinics'),
  },
  { id: 'home', label: 'My Care', icon: House, fills: true, path: routes.myCare(), signedIn: true, match: (p: string) => p.startsWith('/my-care') },
  { id: 'appts', label: 'Appointments', icon: CalendarDays, fills: false, path: routes.appointments(), signedIn: true, match: (p: string) => p.startsWith('/appointments') },
] as const

export type NavItem = (typeof NAV)[number]

/** Where a nav item leads: signed-in places go through sign-in first when signed out. */
export function useNavHref() {
  const { account } = useAccount()
  return (n: NavItem) => (n.signedIn && !account ? routes.signIn(n.path) : n.path)
}
