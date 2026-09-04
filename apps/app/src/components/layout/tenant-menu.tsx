import { Check, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'

/**
 * The workspace (tenant) switcher in the topbar: a 22px initials badge, the tenant name and a
 * chevron. Until /bootstrap exists the tenant is read from the subdomain, and the menu lists only
 * the current one; memberships will fill it.
 */
export function useTenant() {
  const label = window.location.hostname.split('.')[0] || 'workspace'
  const name = label.charAt(0).toUpperCase() + label.slice(1)
  const short = name.slice(0, 2).toUpperCase()
  return { name, short, meta: 'Current workspace' }
}

export function TenantMenu() {
  const tenant = useTenant()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="group flex h-[34px] items-center gap-2 rounded-full px-[11px] outline-none transition-colors duration-instant ease-hexa hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-ring data-open:bg-sidebar-hover"
            aria-label={`Workspace: ${tenant.name}`}
          />
        }
      >
        <span className="grid size-[22px] shrink-0 place-items-center rounded-[7px] bg-secondary-hover/60 text-[9.5px] font-bold tracking-[0.02em] text-muted-foreground">
          {tenant.short}
        </span>
        <span className="hidden max-w-[118px] truncate text-compact font-medium text-body lg:block">{tenant.name}</span>
        <ChevronDown className="size-[9px] shrink-0 text-muted-foreground" strokeWidth={2.5} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 pt-1 pb-2">Workspace</DropdownMenuLabel>
          <DropdownMenuItem className="gap-3 rounded-[9px] px-3 py-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-secondary-hover/60 text-[10px] font-bold text-muted-foreground">
              {tenant.short}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ui-sm font-bold text-foreground">{tenant.name}</span>
              <span className="block text-fine text-faint">{tenant.meta}</span>
            </span>
            <Check className="size-3.5 text-sage" strokeWidth={2.5} />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
