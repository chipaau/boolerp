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
import { NavUser } from './nav-user'
import type { AppDef } from '@/lib/apps'

// Per-app collapsible sidebar: app header (logo + name), menu sections, and the user menu in the
// footer. The active item is derived from the current path.
export function AppSidebar({ app }: { app: AppDef }) {
  const { pathname } = useLocation()
  const base = `/${app.slug}`
  const Icon = app.icon

  return (
    <Sidebar className="top-14 h-[calc(100svh-3.5rem)]!" collapsible="icon">
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/$app" params={{ app: app.slug }}>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
                  <Icon className="size-4" />
                </div>
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-medium">{app.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{app.description}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {app.menu.map((section, i) => (
          <SidebarGroup key={section.title ?? `s${i}`}>
            {section.title && <SidebarGroupLabel>{section.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const to = item.slug ? `${base}/${item.slug}` : base
                  const ItemIcon = item.icon
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={pathname === to} tooltip={item.title}>
                        {item.slug ? (
                          <Link
                            to="/$app/$section"
                            params={{ app: app.slug, section: item.slug }}
                          >
                            {ItemIcon && <ItemIcon />}
                            <span>{item.title}</span>
                          </Link>
                        ) : (
                          <Link to="/$app" params={{ app: app.slug }}>
                            {ItemIcon && <ItemIcon />}
                            <span>{item.title}</span>
                          </Link>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
