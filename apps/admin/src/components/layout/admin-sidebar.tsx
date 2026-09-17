import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Building2, LayoutDashboard, LifeBuoy, MapPin, MessageSquarePlus, ReceiptText, UserCog } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HexGlyph } from '@workspace/ui/components/hex-glyph'
import { useToast } from '@workspace/ui/components/toast'
import { SidebarAttention, WorkspaceSidebar } from '@workspace/ui/components/workspace-sidebar'
import type { SidebarAttentionTone, SidebarNavGroup } from '@workspace/ui/components/workspace-sidebar'
import { useAttention, useNavHints } from '@/features/attention/queries'
import type { AttentionTone, NavHints } from '@/features/attention/queries'
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

const ATTENTION_TONE: Record<AttentionTone, SidebarAttentionTone> = { warning: 'warning', danger: 'risk', caution: 'caution', muted: 'neutral' }

/**
 * The console rail: the same shared WorkspaceSidebar every Bool app renders, fed with the console's
 * groups. "Needs attention" rows are buttons, not links, so the rail keeps exactly one link named
 * "Tenants" (the e2e relies on it).
 */
export function AdminSidebar() {
  const { pathname } = useLocation()
  const hints = useNavHints()
  const attention = useAttention()
  const navigate = useNavigate()
  const toast = useToast()

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`))
  const groups: SidebarNavGroup[] = NAV.map((section) => ({
    title: section.title,
    items: section.items.map((item) => ({
      key: item.to,
      title: item.title,
      icon: item.icon,
      render: <Link {...routeLink(item.to)} />,
      active: isActive(item.to),
      count: item.hint ? hints[item.hint] : undefined,
      countTone: item.tone,
    })),
  }))

  return (
    <WorkspaceSidebar
      // no admin artwork in packages/assets/logos yet, so the plate carries the hex glyph like AppIcon's fallback
      identity={{ glyph: <HexGlyph size={20} className="text-tone-slate" />, name: 'Admin', description: 'Tenants, billing and access' }}
      groups={groups}
      footer={{
        actions: [
          { label: 'Support', icon: LifeBuoy, onClick: () => toast('Platform support runs through the Bool on-call channel.') },
          { label: 'Send feedback', icon: MessageSquarePlus, onClick: () => toast('Feedback for the console opens here once it is wired up.') },
        ],
        madeBy: { href: 'https://bool.mv' },
      }}
    >
      <SidebarAttention
        items={attention.map((a) => ({
          key: a.key,
          label: a.label,
          count: a.count,
          tone: ATTENTION_TONE[a.tone],
          render: <button type="button" onClick={() => void navigate(routeLink(a.target.to, a.target.search) as never)} />,
        }))}
      />
    </WorkspaceSidebar>
  )
}
