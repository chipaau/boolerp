import { Link, useLocation } from '@tanstack/react-router'
import { Building2, LayoutDashboard, LifeBuoy, MapPin, MessageSquarePlus, ReceiptText, UserCog } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import adminGlyph from '@workspace/assets/logos/admin-glyph.png'
import { useToast } from '@workspace/ui/components/toast'
import { WorkspaceSidebar } from '@workspace/ui/components/workspace-sidebar'
import type { SidebarNavGroup } from '@workspace/ui/components/workspace-sidebar'
import { useAttention, useNavHints } from '@/features/attention/queries'
import type { NavHints } from '@/features/attention/queries'
import { routeLink } from '@/lib/route-link'

type NavItem = { title: string; to: string; icon: LucideIcon; hint?: keyof NavHints; tone?: 'risk' | 'warning' }

// Dashboard is ours (the design has no overview screen). Billing, Geographies and Admin users are
// other screens' routes, which is why links go through `routeLink` rather than the typed route union.
const NAV: { title?: string; items: NavItem[] }[] = [
  { items: [{ title: 'Dashboard', to: '/', icon: LayoutDashboard }] },
  {
    title: 'Platform',
    items: [
      { title: 'Tenants', to: '/tenants', icon: Building2, hint: 'tenants' },
      { title: 'Billing', to: '/billing', icon: ReceiptText, hint: 'billing', tone: 'warning' },
      { title: 'Geographies', to: '/geographies', icon: MapPin, hint: 'geographies' },
      { title: 'Admin users', to: '/admin-users', icon: UserCog, hint: 'adminUsers' },
    ],
  },
]

/**
 * The console rail: the same shared WorkspaceSidebar every Bool app renders, fed with the console's
 * groups. What needs attention lives on the Dashboard; the rail shows its total on the Dashboard row.
 * The rail keeps exactly one link named "Tenants" (the e2e relies on it).
 */
export function AdminSidebar() {
  const { pathname } = useLocation()
  const hints = useNavHints()
  const attention = useAttention()
  const toast = useToast()

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`))
  // what needs attention is listed on the Dashboard; the rail only carries its total, like the bell
  const open = attention.reduce((n, a) => n + a.count, 0)
  const openTone = attention.some((a) => a.tone === 'danger') ? 'risk' : 'warning'
  const groups: SidebarNavGroup[] = NAV.map((section) => ({
    title: section.title,
    items: section.items.map((item) => ({
      key: item.to,
      title: item.title,
      icon: item.icon,
      render: <Link {...routeLink(item.to)} />,
      active: isActive(item.to),
      count: item.to === '/' ? open : item.hint ? hints[item.hint] : undefined,
      countTone: item.to === '/' ? openTone : item.tone,
      countLabel: item.to === '/' ? `${open} ${open === 1 ? 'item needs' : 'items need'} attention` : undefined,
    })),
  }))

  return (
    <WorkspaceSidebar
      identity={{ glyph: <img src={adminGlyph} alt="" aria-hidden="true" className="size-[26px] object-contain dark:brightness-[.82] dark:saturate-[.9]" />, name: 'Admin', description: 'Tenants, billing and access' }}
      groups={groups}
      footer={{
        actions: [
          { label: 'Support', icon: LifeBuoy, onClick: () => toast('Platform support runs through the Bool on-call channel.') },
          { label: 'Send feedback', icon: MessageSquarePlus, onClick: () => toast('Feedback for the console opens here once it is wired up.') },
        ],
        madeBy: { href: 'https://bool.mv' },
      }}
    />
  )
}
