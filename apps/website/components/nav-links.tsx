'use client'

import { ArrowRight, SlidersHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import { CELL, CELL_LABEL } from './header-cell'
import { HexFill } from './hex-fill'

// the products with a page of their own, in the Products menu
export const PRODUCTS: { label: string; href: string; icon: LucideIcon; body: string }[] = [
  { label: 'Control Centre', href: '/control-centre', icon: SlidersHorizontal, body: 'The record every app reads' },
]

// Products, two of the home page's own sections (from any page, so through `/`), and About us
export const NAV: { label: string; href: string; menu?: boolean }[] = [
  { label: 'Products', href: '/control-centre', menu: true },
  { label: 'Workspace', href: '/#workspace' },
  { label: 'Deployment', href: '/#deployment' },
  { label: 'About us', href: '/about' },
]

/**
 * The header's sections, each a cell of the bar. On hover (or keyboard focus, or while Products'
 * menu is open) the cell fills with hexagons, sweeping in from the side the pointer came from, and
 * its label turns light; leaving, the hexagons dissolve away.
 */
export function NavLinks() {
  return (
    <nav aria-label="Main" className="hidden h-full lg:flex">
      {NAV.map((item) => {
        const inner = (
          <>
            <HexFill />
            <span className={CELL_LABEL}>{item.label}</span>
          </>
        )
        if (!item.menu)
          return (
            <a key={item.label} href={item.href} className={`${CELL} w-[7.25rem] xl:w-[8.25rem]`}>
              {inner}
            </a>
          )
        return (
          <Popover key={item.label}>
            <PopoverTrigger openOnHover delay={80} closeDelay={160} className={`${CELL} w-[7.25rem] xl:w-[8.25rem]`}>
              {inner}
            </PopoverTrigger>
            <PopoverContent sideOffset={0} align="start" className="w-80 rounded-none rounded-b-lg p-2">
              {PRODUCTS.map(({ label: name, href, icon: Icon, body }) => (
                <a key={href} href={href} className="flex items-start gap-3 rounded-md p-3 outline-none transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/5">
                  <Icon className="mt-0.5 size-5 shrink-0 text-(--brand)" strokeWidth={1.6} />
                  <span className="grow">
                    <span className="block text-[15px] font-bold text-foreground">{name}</span>
                    <span className="block text-[13.5px] text-muted-foreground">{body}</span>
                  </span>
                  <ArrowRight className="mt-1 size-4 text-muted-foreground" strokeWidth={1.7} />
                </a>
              ))}
            </PopoverContent>
          </Popover>
        )
      })}
    </nav>
  )
}
