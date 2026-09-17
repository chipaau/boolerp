"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { useRender } from "@base-ui/react/use-render"

import { cn } from "@workspace/ui/lib/utils"

const listClass = "relative flex items-end gap-[26px] border-b border-divider"
const triggerClass =
  "inline-flex items-center gap-1.5 pb-[11px] text-ui whitespace-nowrap text-muted-foreground transition-colors duration-instant ease-bool outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-disabled-foreground aria-disabled:pointer-events-none aria-disabled:text-disabled-foreground data-active:font-bold data-active:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
// the one rule under the active tab; it slides between tabs
const indicatorClass =
  "pointer-events-none absolute -bottom-px left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-brand-soft transition-[translate,width] duration-considered ease-bool motion-reduce:transition-none"

/** Underline tabs: taupe labels, the active one in bold ink over a 2px brand-orange rule that slides on select. */
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-5", className)}
      {...props}
    />
  )
}

/** The tab row with its thin divider; renders the sliding indicator after the triggers. */
function TabsList({ className, children, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(listClass, className)}
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator data-slot="tabs-indicator" className={indicatorClass} />
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(triggerClass, className)}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

/**
 * The same underline look for tabs without panels — route links, search params or local state.
 * Mark the current item with `active`; the rule measures it and slides there.
 */
function LinkTabs({ className, children, ...props }: React.ComponentProps<"nav">) {
  const ref = React.useRef<HTMLElement>(null)
  const [pos, setPos] = React.useState<{ left: number; width: number } | null>(null)

  React.useLayoutEffect(() => {
    const nav = ref.current
    if (!nav) return
    const measure = () => {
      const el = nav.querySelector<HTMLElement>('[data-slot="link-tab"][data-active]')
      if (!el) return setPos(null)
      const n = nav.getBoundingClientRect(), r = el.getBoundingClientRect()
      setPos({ left: r.left - n.left + nav.scrollLeft, width: r.width })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(nav)
    nav.querySelectorAll('[data-slot="link-tab"]').forEach((t) => ro.observe(t))
    const mo = new MutationObserver(measure)
    mo.observe(nav, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-active"] })
    return () => { ro.disconnect(); mo.disconnect() }
  }, [])

  return (
    <nav ref={ref} data-slot="link-tabs" className={cn(listClass, className)} {...props}>
      {children}
      <span
        aria-hidden="true"
        data-slot="tabs-indicator"
        className={cn(indicatorClass, !pos && "hidden")}
        style={{ "--active-tab-left": `${pos?.left ?? 0}px`, "--active-tab-width": `${pos?.width ?? 0}px` } as React.CSSProperties}
      />
    </nav>
  )
}

/** One item in `LinkTabs`: a button by default, or pass `render={<Link … />}`. */
function LinkTab({ active = false, disabled = false, render, className, ...props }: useRender.ComponentProps<"button"> & { active?: boolean; disabled?: boolean }) {
  return useRender({
    defaultTagName: "button",
    render,
    props: {
      "data-slot": "link-tab",
      "data-active": active ? "" : undefined,
      "aria-current": active ? "page" : undefined,
      "aria-disabled": disabled || undefined,
      ...(render ? {} : { type: "button" as const }),
      className: cn(triggerClass, className),
      ...props,
    },
  })
}

export { Tabs, TabsList, TabsTrigger, TabsContent, LinkTabs, LinkTab }
