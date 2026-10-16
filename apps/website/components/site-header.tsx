import { ArrowRight } from 'lucide-react'
import { Brand } from './brand'
import { HeaderMotion } from './header-motion'
import { HexFill } from './hex-fill'
import { MobileMenu } from './mobile-menu'
import { CELL, CELL_LABEL } from './header-cell'
import { NavLinks } from './nav-links'

/**
 * The site's top bar, ruled into cells: the brand, then the sections and About us, then Let's talk in
 * amber, the way in. Each cell fills with hexagons on hover (nav-links.tsx). HeaderMotion moves the
 * bar aside while the visitor scrolls down, and keeps it up while the hero's bee flies past it. On
 * phones and small tablets the sections move into a Menu (mobile-menu.tsx).
 */
export function SiteHeader({ className }: { className?: string }) {
  return (
    <HeaderMotion className={className}>
      <div className="flex h-14 border-b border-border bg-background">
        <div className="flex items-center gutter">
          <Brand className="text-[1.3rem] [&_img]:h-7" />
        </div>
        <div className="ml-auto flex h-full">
          <NavLinks />
          <MobileMenu />
          <a href="/contact" className={`${CELL} header-cell-accent sm:w-[8.5rem] xl:w-[9.5rem]`}>
            <HexFill />
            <span className={CELL_LABEL}>Let’s talk</span>
            <ArrowRight className="relative size-4" strokeWidth={1.8} />
          </a>
        </div>
      </div>
    </HeaderMotion>
  )
}
