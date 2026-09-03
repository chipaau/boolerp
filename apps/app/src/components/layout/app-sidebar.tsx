import { Link, useLocation, useSearch } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
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
import { cn } from '@workspace/ui/lib/utils'
import { useNavCounts, useSavedViews } from '@/features/shell/queries'
import type { AppDef, AppMenuItem, AppMenuSection } from '@/lib/apps'

const BADGE_TONE = {
  risk: 'bg-tone-risk-soft text-tone-risk-foreground',
  warning: 'bg-tone-warning-soft text-tone-warning-foreground',
} as const

/**
 * The design's rail: an overline label per group, right-rounded rows that bleed to the rail's
 * edge (ivory + short amber bar when active), counts at the right, saved views that carry their
 * filter as search params, and "Back to all apps" at the foot. The account lives in the topbar.
 */
export function AppSidebar({ app }: { app: AppDef }) {
  const { pathname } = useLocation()
  const search: Record<string, string | undefined> = useSearch({ strict: false })
  const base = `/${app.slug}`
  const counts = useNavCounts(app.slug)
  const views = useSavedViews(app.slug)

  // the registry's groups, then the user's saved views as one more group (same row shape)
  const groups: AppMenuSection[] = views.length
    ? [...app.menu, { title: 'My views', items: views.map((v) => ({ title: v.title, slug: v.section, search: v.search, badge: v.badgeKey ? { key: v.badgeKey } : undefined })) }]
    : app.menu

  function isActive(item: AppMenuItem) {
    const to = item.slug ? `${base}/${item.slug}` : base
    if (pathname !== to) return false
    const want = item.search ?? {}
    // a plain link is active only when no preset filter is applied; a view when its preset matches
    return ['filter', 'q'].every((k) => (search[k] ?? undefined) === (want[k] ?? undefined))
  }

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" collapsible="icon">
      <SidebarContent className="gap-0 px-[22px] pt-5 group-data-[collapsible=icon]:px-2">
        {groups.map((section, i) => (
          <SidebarGroup
            key={section.title ?? `s${i}`}
            className={cn('p-0', i > 0 && 'mt-[18px] border-t border-sidebar-border pt-4')}
          >
            {section.title && <SidebarGroupLabel className="mb-2.5 h-auto">{section.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="gap-px">
                {section.items.map((item) => {
                  const ItemIcon = item.icon
                  const count = item.badge ? counts[item.badge.key] : undefined
                  const link = item.slug ? (
                    <Link to="/$app/$section" params={{ app: app.slug, section: item.slug }} search={item.search} />
                  ) : (
                    <Link to="/$app" params={{ app: app.slug }} />
                  )
                  return (
                    <SidebarMenuItem key={`${item.slug}:${item.title}`}>
                      <SidebarMenuButton
                        render={link}
                        isActive={isActive(item)}
                        tooltip={item.title}
                        className={cn(count !== undefined && 'pr-10')}
                      >
                        {ItemIcon && <ItemIcon strokeWidth={1.75} />}
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      {item.badge && count !== undefined && (
                        <SidebarMenuBadge className={cn('-right-2.5 top-2', item.badge.tone && BADGE_TONE[item.badge.tone])}>
                          {count}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="mx-[22px] border-t border-sidebar-border px-0 pt-3.5 pb-[18px] group-data-[collapsible=icon]:mx-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 rounded-md py-2 pl-[13px] text-[13px] text-link outline-none transition-colors duration-instant ease-hexa hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:pl-2"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.75} />
          <span className="group-data-[collapsible=icon]:hidden">Back to all apps</span>
        </Link>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
