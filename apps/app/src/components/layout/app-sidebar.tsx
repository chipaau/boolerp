import { Link, useLocation, useSearch } from '@tanstack/react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@workspace/ui/components/sidebar'
import { cn } from '@workspace/ui/lib/utils'
import { AppIcon } from '@/components/app-icon'
import { NavUser } from './nav-user'
import type { AppDef, AppMenuItem } from '@/lib/apps'

const BADGE_TONE = {
  risk: 'bg-tone-risk-soft text-tone-risk-foreground',
  warning: 'bg-tone-warning-soft text-tone-warning-foreground',
} as const

// Per-app labelled sidebar (248px, one hairline from the content). Items have no pill: the
// active one takes the amber bar and bold ink. Counts sit at the right edge; saved views carry
// their filter as search params and are active only when those match.
export function AppSidebar({ app }: { app: AppDef }) {
  const { pathname } = useLocation()
  const search = useSearch({ strict: false }) as Record<string, string | undefined>
  const base = `/${app.slug}`

  function isActive(item: AppMenuItem) {
    const to = item.slug ? `${base}/${item.slug}` : base
    if (pathname !== to) return false
    const want = item.search ?? {}
    // a plain link is active only when no preset filter is applied; a view when its preset matches
    const keys = ['filter', 'q']
    return keys.every((k) => (search[k] ?? undefined) === (want[k] ?? undefined))
  }

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" collapsible="icon">
      <SidebarHeader className="px-5 pt-6 pb-2 group-data-[collapsible=icon]:px-2">
        <Link
          to="/$app"
          params={{ app: app.slug }}
          className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[10px] bg-muted">
            <AppIcon slug={app.slug} size={22} />
          </span>
          <span className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[15px] font-bold text-foreground">{app.name}</span>
            <span className="truncate text-xs text-muted-foreground">{app.description}</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-5 group-data-[collapsible=icon]:px-2">
        {app.menu.map((section, i) => (
          <SidebarGroup key={section.title ?? `s${i}`} className="p-0 pt-3">
            {section.title && <SidebarGroupLabel>{section.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {section.items.map((item) => {
                  const ItemIcon = item.icon
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
                        className={cn(item.badge && 'pr-12')}
                      >
                        {ItemIcon && <ItemIcon strokeWidth={1.75} />}
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      {item.badge && (
                        <SidebarMenuBadge
                          className={cn(
                            item.badge.tone ? BADGE_TONE[item.badge.tone] : 'bg-transparent font-normal text-faint',
                            'top-2'
                          )}
                        >
                          {item.badge.value}
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

      <SidebarFooter className="border-t border-sidebar-border">
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
