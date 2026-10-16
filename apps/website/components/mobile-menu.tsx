'use client'

import { useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@workspace/ui/components/sheet'
import { Brand } from './brand'
import { CELL, CELL_LABEL } from './header-cell'
import { HexFill } from './hex-fill'
import { NAV, PRODUCTS } from './nav-links'

/** A row of the menu: ruled off below, its label at the left, filling with hexagons on hover. */
const ROW = 'header-cell relative flex h-14 items-center justify-between overflow-hidden border-b border-border gutter outline-none'

/**
 * The header's sections on phones and small tablets, where they don't fit the bar: a Menu cell
 * opening a panel from the top, the same items as ruled rows (the products under Products), and
 * Let's talk last, in amber. A link closes the panel as it goes.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={`${CELL} lg:hidden`}>
        <HexFill />
        <Menu className="relative size-4" strokeWidth={1.8} />
        <span className={CELL_LABEL}>Menu</span>
      </SheetTrigger>
      <SheetContent side="top" showCloseButton={false} className="gap-0 rounded-none bg-background p-0 shadow-[0_24px_50px_-24px_rgb(110_76_36/0.35)] lg:hidden">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        {/* the bar again, its Menu cell now Close */}
        <div className="flex h-14 border-b border-border">
          <div className="flex items-center gutter">
            <Brand className="text-[1.3rem] [&_img]:h-7" />
          </div>
          <SheetClose className={`${CELL} ml-auto`}>
            <HexFill />
            <X className="relative size-4" strokeWidth={1.8} />
            <span className={CELL_LABEL}>Close</span>
          </SheetClose>
        </div>
        <nav aria-label="Main" className="flex flex-col">
          {NAV.map((item) => (
            <div key={item.label} className="contents">
              <a href={item.href} onClick={close} className={ROW}>
                <HexFill />
                <span className={CELL_LABEL}>{item.label}</span>
                <ArrowRight className="relative size-4 opacity-60" strokeWidth={1.8} />
              </a>
              {item.menu &&
                PRODUCTS.map(({ label, href, icon: Icon }) => (
                  <a key={href} href={href} onClick={close} className={`${ROW} pl-10`}>
                    <HexFill />
                    <span className="relative flex items-center gap-2.5 text-[14px]">
                      <Icon className="size-4 text-(--brand)" strokeWidth={1.7} />
                      {label}
                    </span>
                  </a>
                ))}
            </div>
          ))}
          <a href="/contact" onClick={close} className={`${ROW} header-cell-accent border-b-0`}>
            <HexFill />
            <span className={CELL_LABEL}>Let’s talk</span>
            <ArrowRight className="relative size-4" strokeWidth={1.8} />
          </a>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
