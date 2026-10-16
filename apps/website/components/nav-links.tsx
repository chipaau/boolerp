'use client'

import { useRef } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HexGlyph } from '@workspace/ui/components/hex-glyph'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'

// the products with a page of their own, in the Products menu
const PRODUCTS: { label: string; href: string; icon: LucideIcon; body: string }[] = [
  { label: 'Control Centre', href: '/control-centre', icon: SlidersHorizontal, body: 'The record every app reads' },
]

// Products, then the home page's own sections (from any page, so through `/`)
const NAV: { label: string; href: string; menu?: boolean }[] = [
  { label: 'Products', href: '/control-centre', menu: true },
  { label: 'Workspace', href: '/#workspace' },
  { label: 'Deployment', href: '/#deployment' },
  { label: 'Solutions', href: '/#solutions' },
  { label: 'Contact', href: '/#contact' },
]

const ITEM =
  'nav-item group/nav flex items-center gap-1.5 py-2 outline-none transition-colors duration-300 hover:text-foreground focus-visible:text-foreground data-popup-open:text-foreground'

/**
 * The header's sections. A small amber hexagon, the brand's mark, sits under the one the pointer or
 * keyboard is on and slides along to the next; it fades in where it is first wanted and out when the
 * pointer leaves the menu (globals.css, .nav-hex). Products opens a menu of the product pages, on
 * hover, click or keyboard.
 */
export function NavLinks() {
  const nav = useRef<HTMLElement>(null)
  const hex = useRef<HTMLSpanElement>(null)

  /** Puts the hexagon under the label of the item at `target`. */
  const mark = (target: HTMLElement) => {
    const label = target.querySelector('[data-nav-label]')
    if (!label || !nav.current || !hex.current) return
    const r = label.getBoundingClientRect()
    const o = nav.current.getBoundingClientRect()
    const h = hex.current
    const x = `${r.left - o.left + r.width / 2}px`
    if ('on' in h.dataset) return void h.style.setProperty('--x', x)
    // hidden: move it there at once, so it fades in in place rather than sliding from the last item
    h.style.transition = 'none'
    h.style.setProperty('--x', x)
    void h.offsetWidth
    h.style.transition = ''
    h.dataset.on = ''
  }
  const unmark = () => {
    // it stays under Products while that menu is open (the pointer is in the menu, outside the bar)
    if (hex.current && !nav.current?.querySelector('[data-popup-open]')) delete hex.current.dataset.on
  }
  const on = {
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => mark(e.currentTarget),
    onFocus: (e: React.FocusEvent<HTMLElement>) => mark(e.currentTarget),
    onBlur: unmark,
  }

  return (
    <nav ref={nav} aria-label="Main" onPointerLeave={unmark} className="relative mx-auto hidden items-center gap-9 text-[15px] text-body lg:flex">
      {NAV.map((item) => {
        const label = <span data-nav-label="">{item.label}</span>
        if (!item.menu)
          return (
            <a key={item.label} href={item.href} className={ITEM} {...on}>
              {label}
            </a>
          )
        return (
          <Popover key={item.label} onOpenChange={(open) => !open && requestAnimationFrame(() => !nav.current?.matches(':hover') && unmark())}>
            <PopoverTrigger openOnHover delay={80} closeDelay={160} className={ITEM} {...on}>
              {label}
              <ChevronDown className="size-4 transition-transform duration-300 group-data-popup-open/nav:rotate-180" strokeWidth={1.7} />
            </PopoverTrigger>
            <PopoverContent sideOffset={14} className="w-80 p-2">
              {PRODUCTS.map(({ label: name, href, icon: Icon, body }) => (
                <a key={href} href={href} className="flex items-start gap-3 rounded-md p-3 outline-none transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/5">
                  <Icon className="mt-0.5 size-5 shrink-0 text-(--brand)" strokeWidth={1.6} />
                  <span>
                    <span className="block text-[15px] font-bold text-foreground">{name}</span>
                    <span className="block text-[13.5px] text-muted-foreground">{body}</span>
                  </span>
                </a>
              ))}
            </PopoverContent>
          </Popover>
        )
      })}
      <span ref={hex} aria-hidden="true" className="nav-hex pointer-events-none absolute -bottom-1.5 left-0 text-(--brand-soft)">
        <HexGlyph size={7} className="block" />
      </span>
    </nav>
  )
}
