import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Building2, LayoutDashboard, LifeBuoy, MapPin, MessageSquarePlus, ReceiptText, UserCog } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HexGlyph } from '@workspace/ui/components/hex-glyph'
import { MadeBy } from '@workspace/ui/components/made-by'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@workspace/ui/components/sidebar'
import { useToast } from '@workspace/ui/components/toast'
import { ToneDot } from '@workspace/ui/components/tone-dot'
import type { DotTone } from '@workspace/ui/components/tone-dot'
import { cn } from '@workspace/ui/lib/utils'
import { useAttention, useNavHints } from '@/features/attention/queries'
import type { AttentionTone, NavHints } from '@/features/attention/queries'
import { routeLink } from '@/lib/route-link'

type NavItem = { title: string; to: string; icon: LucideIcon; hint?: keyof NavHints; tone?: 'risk' | 'warning' }

// Dashboard is ours (the design has no overview screen). Billing, Geographies and Admin users are
// other screens' routes, which is why links go through `routeLink` rather than the typed route union.
const NAV: { title: string; items: NavItem[] }[] = [
  { title: 'Console', items: [{ title: 'Dashboard', to: '/', icon: LayoutDashboard }] },
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

const BADGE_TONE = {
  risk: 'bg-tone-risk-soft text-tone-risk-foreground',
  warning: 'bg-tone-warning-soft text-tone-warning-foreground',
} as const
const DOT: Record<AttentionTone, DotTone> = { warning: 'warning', danger: 'risk', caution: 'tan', muted: 'neutral' }

const groupRule = 'relative mt-[18px] pt-4 before:absolute before:top-0 before:right-0 before:left-0 before:h-px before:bg-sidebar-border'

/**
 * The console rail, built exactly like apps/app's AppSidebar: the app's identity at the top (glyph
 * plate, "Admin", one line), overline-labelled groups of right-rounded rows with counts at the
 * right, then "Needs attention" — buttons, not links, so the rail keeps exactly one link named
 * "Tenants". Support, feedback and the maker's mark sit at the foot; collapses to icons.
 */
export function AdminSidebar() {
  const { pathname } = useLocation()
  const hints = useNavHints()
  const attention = useAttention()
  const navigate = useNavigate()
  const toast = useToast()

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`))

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" collapsible="icon">
      <SidebarContent className="gap-0 pt-5 pr-3 pl-[22px] group-data-[collapsible=icon]:px-2">
        <div className="mb-5 flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          {/* no admin artwork in packages/assets/logos yet, so the plate carries the hex glyph like AppIcon's fallback */}
          <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-surface-soft shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand)_14%,transparent)]" title="Admin">
            <HexGlyph size={20} className="text-tone-slate" />
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-heading-sm font-bold text-foreground">Admin</div>
            <div className="truncate text-caption text-muted-foreground">Tenants, billing and access</div>
          </div>
        </div>

        {NAV.map((section, i) => (
          <SidebarGroup key={section.title} className={cn('p-0', i > 0 && groupRule)}>
            {i > 0 && <SidebarGroupLabel className="mb-2.5 h-auto">{section.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="gap-px">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const count = item.hint ? hints[item.hint] : undefined
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton render={<Link {...routeLink(item.to)} />} isActive={isActive(item.to)} tooltip={item.title} className={cn(count !== undefined && 'pr-10')}>
                        <Icon strokeWidth={1.75} />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      {count !== undefined && (
                        <SidebarMenuBadge className={cn('top-2 right-2.5', item.tone && count > 0 && BADGE_TONE[item.tone])}>{count}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup className={cn('p-0 group-data-[collapsible=icon]:hidden', groupRule)}>
          <SidebarGroupLabel className="mb-2.5 h-auto">Needs attention</SidebarGroupLabel>
          <SidebarGroupContent>
            {attention.length === 0 ? (
              <p className="px-4 py-1.5 text-caption text-faint">Nothing needs a look right now.</p>
            ) : (
              <SidebarMenu className="gap-px">
                {attention.map((a) => (
                  <SidebarMenuItem key={a.key}>
                    <SidebarMenuButton onClick={() => void navigate(routeLink(a.target.to, a.target.search) as never)} className="pr-10">
                      <ToneDot tone={DOT[a.tone]} shape="round" size={7} className="mx-[4.5px]" />
                      <span>{a.label}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className={cn('top-2 right-2.5', a.tone === 'danger' && BADGE_TONE.risk, a.tone === 'warning' && BADGE_TONE.warning)}>{a.count}</SidebarMenuBadge>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-0 border-t border-sidebar-border px-3 pt-2 pb-3.5 group-data-[collapsible=icon]:px-2">
        <SidebarMenu className="gap-px">
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Support" onClick={() => toast('Platform support runs through the Bool on-call channel.')}>
              <LifeBuoy strokeWidth={1.75} />
              <span>Support</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Send feedback" onClick={() => toast('Feedback for the console opens here once it is wired up.')}>
              <MessageSquarePlus strokeWidth={1.75} />
              <span>Send feedback</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <MadeBy href="https://bool.mv" className="mt-3.5 ps-4 group-data-[collapsible=icon]:hidden" />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
