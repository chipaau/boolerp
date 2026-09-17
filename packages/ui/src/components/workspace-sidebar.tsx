import * as React from "react"
import { ChevronDown } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { MadeBy } from "@workspace/ui/components/made-by"
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
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { ToneDot } from "@workspace/ui/components/tone-dot"
import type { DotTone } from "@workspace/ui/components/tone-dot"
import { cn } from "@workspace/ui/lib/utils"

export type SidebarCountTone = "neutral" | "warning" | "risk"

/** One rail row. `render` is the element the row becomes (a router Link, or a button with onClick). */
export type SidebarNavItem = {
  key: string
  title: string
  /** a Lucide icon component, or any node (a ToneDot, an AppIcon) */
  icon?: LucideIcon | React.ReactNode
  render: React.ReactElement
  active?: boolean
  /** shown only when it needs attention: a tinted pill when `countTone` is warning or risk and the count is above 0 */
  count?: number
  countTone?: SidebarCountTone
  /** accessible name for the count ("3 items need attention") */
  countLabel?: string
  /** child rows: the row gets a chevron (hidden when empty) and the children show while `open` */
  items?: SidebarNavItem[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export type SidebarNavGroup = { title?: string; items: SidebarNavItem[] }

export type SidebarAttentionTone = "neutral" | "caution" | "warning" | "risk"

export type SidebarAttentionItem = { key: string; label: string; count: number; tone: SidebarAttentionTone; render: React.ReactElement }

export type WorkspaceSidebarProps = {
  identity: { glyph: React.ReactNode; name: string; description?: string }
  groups?: SidebarNavGroup[]
  footer?: {
    actions?: { label: string; icon: LucideIcon; onClick: () => void }[]
    madeBy?: { href?: string; by?: string }
  }
  /** extra sections (SidebarNavGroups, SidebarSection, SidebarAttention) rendered after the groups */
  children?: React.ReactNode
  className?: string
}

const COUNT_TONE: Record<Exclude<SidebarCountTone, "neutral">, string> = {
  risk: "bg-tone-risk-soft text-tone-risk-foreground",
  warning: "bg-tone-warning-soft text-tone-warning-foreground",
}

const ATTENTION_DOT: Record<SidebarAttentionTone, DotTone> = { neutral: "neutral", caution: "tan", warning: "warning", risk: "risk" }

// every block after the first carries the hairline rule and the gap above it
const BLOCK = "relative p-0 not-first:mt-3 not-first:pt-3 not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-0 not-first:before:h-px not-first:before:bg-sidebar-border"

function isComponent(icon: SidebarNavItem["icon"]): icon is LucideIcon {
  return typeof icon === "function" || (typeof icon === "object" && icon !== null && !React.isValidElement(icon) && "render" in icon)
}

function NavRow({ item, depth, tree }: { item: SidebarNavItem; depth: number; tree: boolean }) {
  const Icon = item.icon
  const kids = item.items ?? []
  const tinted = item.countTone && item.countTone !== "neutral" && (item.count ?? 0) > 0
  // 9px puts a top-level icon directly under the identity plate's glyph; tree rows indent from there
  const pad = 9 + (tree ? 18 : 0) + depth * 14
  return (
    <SidebarMenuItem className={cn(depth > 0 && "group-data-[collapsible=icon]:hidden")}>
      {tree && (
        <button
          type="button"
          aria-label={item.open ? `Collapse ${item.title}` : `Expand ${item.title}`}
          aria-expanded={kids.length ? !!item.open : undefined}
          onClick={() => item.onOpenChange?.(!item.open)}
          style={{ left: 2 + depth * 14 }}
          className={cn(
            "absolute top-2.5 z-10 grid size-4 place-items-center rounded text-faint transition-transform duration-instant group-data-[collapsible=icon]:hidden",
            !item.open && "-rotate-90",
            !kids.length && "invisible"
          )}
        >
          <ChevronDown className="size-3" strokeWidth={1.8} />
        </button>
      )}
      <SidebarMenuButton
        render={item.render}
        isActive={!!item.active}
        tooltip={item.title}
        style={{ paddingLeft: pad }}
        className={cn(tinted && "pr-10")}
      >
        {isComponent(Icon) ? <Icon strokeWidth={1.75} /> : Icon}
        {Icon === undefined && (
          <span aria-hidden="true" data-slot="nav-initial" className="hidden w-4 text-center font-bold group-data-[collapsible=icon]:block">
            {item.title.charAt(0)}
          </span>
        )}
        <span className={cn(Icon === undefined && "group-data-[collapsible=icon]:hidden")}>{item.title}</span>
      </SidebarMenuButton>
      {tinted && (
        <SidebarMenuBadge aria-label={item.countLabel} className={cn("top-1.5 right-2.5", COUNT_TONE[item.countTone as "warning" | "risk"])}>
          {item.count}
        </SidebarMenuBadge>
      )}
      {item.open && kids.length > 0 && (
        <SidebarMenu className="mt-px gap-px group-data-[collapsible=icon]:hidden">
          {kids.map((k) => (
            <NavRow key={k.key} item={k} depth={depth + 1} tree={tree} />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}

/** Rail groups: an overline label (when titled), then the rows. Use inside a custom rail. */
function SidebarNavGroups({ groups }: { groups: SidebarNavGroup[] }) {
  return (
    <>
      {groups.map((g, i) => {
        const tree = g.items.some((it) => it.items !== undefined)
        return (
          <SidebarGroup key={g.title ?? `group-${i}`} data-slot="workspace-sidebar-group" className={BLOCK}>
            {g.title && <SidebarGroupLabel className="mb-1.5 h-auto">{g.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="gap-px">
                {g.items.map((item) => (
                  <NavRow key={item.key} item={item} depth={0} tree={tree} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </>
  )
}

/**
 * A free-form rail section with the same rule and overline label as the groups. `action` sits at
 * the label's right; `collapsed` is what shows when the rail is folded to icons (nothing by default).
 */
function SidebarSection({
  title,
  action,
  collapsed,
  children,
  className,
}: {
  title?: string
  action?: React.ReactNode
  collapsed?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const folded = useSidebar().state === "collapsed"
  if (folded && !collapsed) return null
  return (
    <SidebarGroup data-slot="workspace-sidebar-section" className={cn(BLOCK, folded && "items-center gap-1.5 before:hidden", className)}>
      {folded ? (
        collapsed
      ) : (
        <>
          {(title || action) && (
            <div className="mb-1.5 flex items-center gap-2">
              {title && <SidebarGroupLabel className="h-auto">{title}</SidebarGroupLabel>}
              {action && <div className="ms-auto">{action}</div>}
            </div>
          )}
          {children}
        </>
      )}
    </SidebarGroup>
  )
}

/** "Needs attention": toned rows with counts, or a quiet line when there is nothing. Hidden when folded. */
function SidebarAttention({
  title = "Needs attention",
  items,
  empty = "Nothing needs a look right now.",
}: {
  title?: string
  items: SidebarAttentionItem[]
  empty?: React.ReactNode
}) {
  const rows: SidebarNavItem[] = items.map((a) => ({
    key: a.key,
    title: a.label,
    icon: <ToneDot tone={ATTENTION_DOT[a.tone]} shape="round" size={7} className="mx-[4.5px]" />,
    render: a.render,
    count: a.count,
    // every attention row is something to look at, so its count always shows (risk stays red, the rest amber)
    countTone: a.tone === "risk" ? "risk" : "warning",
  }))
  return (
    <SidebarSection title={title}>
      {rows.length === 0 ? (
        <p className="px-4 py-1.5 text-caption text-faint">{empty}</p>
      ) : (
        <SidebarMenu className="gap-px">
          {rows.map((r) => (
            <NavRow key={r.key} item={r} depth={0} tree={false} />
          ))}
        </SidebarMenu>
      )}
    </SidebarSection>
  )
}

/**
 * The one rail every Bool app uses: identity (glyph plate, name, one line) at the top, overline-
 * labelled groups of right-rounded rows with counts, any extra sections, then support/feedback and
 * the maker's mark at the foot. Collapses to icons; rows without an icon show their initial.
 * Must sit inside a SidebarProvider.
 */
function WorkspaceSidebar({ identity, groups = [], footer, children, className }: WorkspaceSidebarProps) {
  return (
    <Sidebar collapsible="icon" className={cn("top-(--header-height) h-[calc(100svh-var(--header-height))]!", className)}>
      {/* rows carry their own right padding so their fill runs almost to the rail's edge, stopping 12px short */}
      <SidebarContent className="gap-0 pt-5 pr-3 pl-[22px] group-data-[collapsible=icon]:px-2">
        <div data-slot="workspace-sidebar-identity" className="mb-4 flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          {/* soft plate with a hairline brand edge */}
          <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-surface-soft shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand)_14%,transparent)]" title={identity.name}>
            {identity.glyph}
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-heading-sm font-bold text-foreground">{identity.name}</div>
            {identity.description && <div className="truncate text-caption text-muted-foreground">{identity.description}</div>}
          </div>
        </div>
        <div data-slot="workspace-sidebar-body" className="flex flex-col">
          <SidebarNavGroups groups={groups} />
          {children}
        </div>
      </SidebarContent>

      {footer && (
        <SidebarFooter className="gap-0 border-t border-sidebar-border px-3 pt-2 pb-3.5 group-data-[collapsible=icon]:px-2">
          {footer.actions && footer.actions.length > 0 && (
            <SidebarMenu className="gap-px">
              {footer.actions.map((a) => {
                const Icon = a.icon
                return (
                  <SidebarMenuItem key={a.label}>
                    <SidebarMenuButton tooltip={a.label} onClick={a.onClick}>
                      <Icon strokeWidth={1.75} />
                      <span>{a.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          )}
          {footer.madeBy && <MadeBy href={footer.madeBy.href} by={footer.madeBy.by} className="mt-3.5 ps-4 group-data-[collapsible=icon]:hidden" />}
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}

export { WorkspaceSidebar, SidebarNavGroups, SidebarSection, SidebarAttention }
