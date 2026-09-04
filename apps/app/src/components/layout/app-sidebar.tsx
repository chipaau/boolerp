import { Link, useLocation, useSearch } from '@tanstack/react-router'
import {
  Sidebar,
  SidebarContent,
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
import { AppIcon } from '@/components/app-icon'
import { getRail } from '@/features/rails'
import { useNavCounts, useSavedViews } from '@/features/shell/queries'
import type { AppDef, AppMenuItem, AppMenuSection } from '@/lib/apps'

const BADGE_TONE = {
  risk: 'bg-tone-risk-soft text-tone-risk-foreground',
  warning: 'bg-tone-warning-soft text-tone-warning-foreground',
} as const

/**
 * The design's rail: the app's identity at the top (glyph plate, name, one-line description), an
 * overline label per further group, right-rounded rows that bleed to the rail's edge (ivory +
 * short amber bar when active), counts at the right, saved views that carry their filter as
 * search params. The account and the way back to Home live in the topbar.
 */
export function AppSidebar({ app }: { app: AppDef }) {
  const { pathname } = useLocation()
  const search: Record<string, string | undefined> = useSearch({ strict: false })
  const base = `/${app.slug}`
  const Rail = getRail(app.slug)
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
      {/* rows carry their own right padding so their fill runs almost to the rail's edge, stopping 12px short */}
      <SidebarContent className="gap-0 pr-3 pl-[22px] pt-5 group-data-[collapsible=icon]:px-2">
        <div className="mb-5 flex items-center gap-3 group-data-[collapsible=icon]:hidden">
          <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-surface-soft">
            <AppIcon slug={app.slug} size={22} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-heading-sm font-bold text-foreground">{app.name}</div>
            <div className="truncate text-caption text-muted-foreground">{app.description}</div>
          </div>
        </div>
        {Rail && <Rail app={app} />}
        {!Rail &&
          groups.map((section, i) => (
          <SidebarGroup
            key={section.title ?? `s${i}`}
            className={cn('p-0', i > 0 && 'relative mt-[18px] pt-4 before:absolute before:top-0 before:right-0 before:left-0 before:h-px before:bg-sidebar-border')}
          >
            {/* the header above already names the app, so a first group titled after it stays unlabelled */}
            {section.title && section.title !== app.name && <SidebarGroupLabel className="mb-2.5 h-auto">{section.title}</SidebarGroupLabel>}
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
                        <SidebarMenuBadge className={cn('right-2.5 top-2', item.badge.tone && BADGE_TONE[item.badge.tone])}>
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

      <SidebarRail />
    </Sidebar>
  )
}
