import { Link, useLocation } from '@tanstack/react-router'
import { Building2, LayoutDashboard  } from 'lucide-react'
import type {LucideIcon} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@workspace/ui/components/sidebar'
import { MadeBy } from '@workspace/ui/components/made-by'

type NavItem = { title: string; to: string; icon: LucideIcon }

// The operator console's whole nav — flat and static, unlike apps/app's per-module registry
// (there's one console here, not a set of business modules to switch between). Grows as
// provisioning/support-access/audit-log UIs land; only what's actually built gets a row.
const NAV: NavItem[] = [
  { title: 'Dashboard', to: '/', icon: LayoutDashboard },
  { title: 'Tenants', to: '/tenants', icon: Building2 },
]

/**
 * The console's rail: same primitives and geometry as apps/app's AppSidebar (right-rounded rows
 * bleeding to the rail's edge, ivory + amber bar when active, collapses to icons), but a flat list
 * — no per-app registry, no saved views, no rail overrides, no nav-count badges (nothing to count yet).
 */
export function AdminSidebar() {
  const { pathname } = useLocation()

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" collapsible="icon">
      <SidebarContent className="gap-0 pr-3 pl-[22px] pt-5 group-data-[collapsible=icon]:px-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {NAV.map((item) => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton render={<Link to={item.to} />} isActive={pathname === item.to} tooltip={item.title}>
                      <Icon strokeWidth={1.75} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-0 border-t border-sidebar-border px-3 pt-2 pb-3.5 group-data-[collapsible=icon]:px-2">
        <MadeBy href="https://bool.mv" className="mt-3.5 ps-4 group-data-[collapsible=icon]:hidden" />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
