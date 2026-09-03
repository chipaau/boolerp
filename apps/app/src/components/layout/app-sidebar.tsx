import { Link, useLocation } from '@tanstack/react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@workspace/ui/components/sidebar'
import { AppIcon } from '@/components/app-icon'
import { NavUser } from './nav-user'
import type { AppDef } from '@/lib/apps'

// Per-app labelled sidebar (248px, one hairline from the content). Items have no pill: the
// active one takes the amber bar and bold ink. The active item is derived from the current path.
export function AppSidebar({ app }: { app: AppDef }) {
  const { pathname } = useLocation()
  const base = `/${app.slug}`

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
                  const to = item.slug ? `${base}/${item.slug}` : base
                  const ItemIcon = item.icon
                  const link = item.slug ? (
                    <Link to="/$app/$section" params={{ app: app.slug, section: item.slug }} />
                  ) : (
                    <Link to="/$app" params={{ app: app.slug }} />
                  )
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton render={link} isActive={pathname === to} tooltip={item.title}>
                        {ItemIcon && <ItemIcon strokeWidth={1.75} />}
                        <span>{item.title}</span>
                      </SidebarMenuButton>
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
