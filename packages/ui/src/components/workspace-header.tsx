import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"
import { useTheme } from "@workspace/ui/hooks/use-theme"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { SearchField } from "@workspace/ui/components/search-field"

/**
 * The global topbar shared by every app: a sticky 3-column grid (brand | search | actions) on the
 * card surface with a bottom hairline. Apps fill the slots with the parts below.
 */
function WorkspaceHeader({
  brand,
  search,
  actions,
  className,
}: {
  brand: React.ReactNode
  search?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header
      data-slot="workspace-header"
      className={cn(
        "sticky top-0 z-50 grid h-(--header-height) w-full grid-cols-[minmax(min-content,1fr)_minmax(150px,340px)_minmax(min-content,1fr)] items-center gap-[18px] border-b border-border bg-card px-6",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-[18px] overflow-hidden">{brand}</div>
      <div className="min-w-0">{search}</div>
      <div className="flex items-center justify-end gap-2 justify-self-end">{actions}</div>
    </header>
  )
}

/** The logo (38px) + product name. `render` supplies the link element (e.g. a router Link home). */
function BrandMark({ logoSrc, name = "Bool", render }: { logoSrc: string; name?: string; render?: React.ReactElement }) {
  const className =
    "flex shrink-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
  const children = (
    <>
      <img src={logoSrc} alt="" aria-hidden="true" width={38} height={38} className="block size-[38px] object-contain" />
      <span className="text-heading-sm font-bold tracking-[-0.01em] text-foreground">{name}</span>
    </>
  )
  const el = render ?? <a href="/" />
  return React.cloneElement(el as React.ReactElement<{ className?: string; children?: React.ReactNode }>, { className, children })
}

/** The vertical hairline between action groups. */
function HeaderDivider() {
  return <span aria-hidden="true" data-slot="header-divider" className="mx-1 h-[22px] w-px bg-border" />
}

const iconButton = "size-[34px] text-muted-foreground hover:bg-sidebar-hover data-open:bg-sidebar-hover"

// The design's sun/moon paths, drawn at 1.6px.
const MOON = "M15.5 12.4A6 6 0 017.6 4.5 6.4 6.4 0 1015.5 12.4z"
const SUN =
  "M10 3.2v1.6M10 15.2v1.6M3.2 10h1.6M15.2 10h1.6M5.4 5.4l1.1 1.1M13.5 13.5l1.1 1.1M14.6 5.4l-1.1 1.1M6.5 13.5l-1.1 1.1M13 10a3 3 0 11-6 0 3 3 0 016 0z"

/** The 34px round light/dark toggle: a sun in dark mode, a moon in light. Persists via useTheme. */
function ThemeToggle() {
  const { isDark, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={iconButton}
      title={isDark ? "Light mode" : "Dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-[17px]">
        <path d={isDark ? SUN : MOON} />
      </svg>
    </Button>
  )
}

/**
 * The search pill in the middle column. It only opens: `onOpen` fires on click and on ⌘K / Ctrl+K,
 * and the app decides what opens (a command palette, a filter dialog…).
 */
function HeaderSearchTrigger({ onOpen, placeholder = "Search" }: { onOpen: () => void; placeholder?: string }) {
  const open = React.useRef(onOpen)
  open.current = onOpen
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        open.current()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  return (
    <SearchField
      asButton
      size="sm"
      placeholder={placeholder}
      shortcut={<span className="text-micro font-medium tracking-[0.04em] text-muted-foreground">⌘K</span>}
      className="justify-self-center"
      onClick={() => onOpen()}
    />
  )
}

export type AppSwitcherItem = {
  key: string
  name: string
  /** Drawn inside the 34px plate (≈22px). */
  icon: React.ReactNode
  /** The link element for the tile (router Link or <a href>). */
  render: React.ReactElement
  active?: boolean
}

/** The 3×3-dots button and its apps grid (icon plate + name, the current app in amber). */
function AppSwitcherMenu({ items, footer }: { items: AppSwitcherItem[]; footer?: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" className={iconButton} aria-label="Switch app" title="Switch app" />}
      >
        <span aria-hidden="true" className="grid grid-cols-3 gap-[3.5px]">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="size-[3px] rounded-full bg-faint" />
          ))}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-2">
        <div className="px-2 pt-1 pb-2.5 text-overline text-faint">Apps</div>
        <div className="grid grid-cols-3 gap-1">
          {items.map((app) =>
            React.cloneElement(
              app.render as React.ReactElement<Record<string, unknown>>,
              {
                key: app.key,
                "aria-current": app.active ? "page" : undefined,
                className:
                  "flex flex-col items-center gap-[7px] rounded-[10px] px-1.5 py-3 outline-none transition-colors duration-instant ease-bool hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                children: (
                  <>
                    <span className="grid size-[34px] place-items-center rounded-[10px] bg-surface-soft">{app.icon}</span>
                    <span className={cn("text-center text-fine leading-tight", app.active ? "font-bold text-tone-warning-deep" : "font-medium text-body")}>
                      {app.name}
                    </span>
                  </>
                ),
              }
            )
          )}
        </div>
        {footer && <div className="mt-2 border-t border-divider pt-2.5 text-center">{footer}</div>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export type AccountMenuItem = {
  key: string
  label: React.ReactNode
  onClick?: () => void
  /** Terracotta, for Sign out. */
  destructive?: boolean
}

/** The 31px avatar and the account dropdown: name and email, then the items. */
function AccountMenu({
  user,
  avatarSrc,
  items,
}: {
  user: { name: string; email: string }
  avatarSrc?: string | null
  items: AccountMenuItem[]
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`${user.name}. Account menu`}
            title={user.name}
            className="ms-0.5 grid size-[34px] place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
        }
      >
        <Avatar name={user.name} className="size-[31px]">
          {avatarSrc && <AvatarImage src={avatarSrc} alt="" />}
          <AvatarFallback className="bg-secondary-hover/60 text-micro tracking-[0.02em] text-muted-foreground" />
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 p-2">
        <div className="px-3 pt-1.5 pb-3">
          <div className="text-sm font-bold text-foreground">{user.name}</div>
          <div className="mt-0.5 text-fine text-faint">{user.email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {items.map((item) => (
            <DropdownMenuItem
              key={item.key}
              className={cn(
                "rounded-[9px] px-3 py-[9px] text-ui-sm",
                item.destructive && "text-tone-risk-foreground data-highlighted:text-tone-risk-foreground"
              )}
              onClick={item.onClick}
            >
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { WorkspaceHeader, BrandMark, HeaderDivider, ThemeToggle, HeaderSearchTrigger, AppSwitcherMenu, AccountMenu }
