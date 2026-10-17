import { ArrowUp } from 'lucide-react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Brand } from './brand'
import { CTA, CTA_ARROW } from './cta'
import { CELL, CELL_LABEL } from './header-cell'
import { HexFill } from './hex-fill'

const LEGAL = ['Privacy', 'Terms', 'Security']

/**
 * The page's close: the last call (the promise and Let's talk), then a ruled bar like the header's
 * with the brand, the small print and Back to top.
 */
export function SiteFooter({ call = true }: { call?: boolean }) {
  return (
    <footer className="relative overflow-hidden bg-background">

      {/* the drafting paper behind the last call, fading out toward the bar below */}
      {call && <div aria-hidden="true" className="office-grid grid-fade-bottom pointer-events-none absolute inset-0" />}

      {/* the last call (not on the contact page, which is the call) */}
      {call && (
        <div className="section-y relative mx-auto grid w-full max-w-7xl gap-8 gutter lg:grid-cols-[1.2fr_1fr] lg:items-end 2xl:max-w-[88rem]">
          <div>
            <p className="text-overline tracking-[0.28em] text-muted-foreground">Ready to simplify your operations?</p>
            <h2 className="section-title mt-4 text-foreground">
              Let’s build a workspace <span className="text-(--brand)">that works for you.</span>
            </h2>
          </div>
          <div className="lg:pb-2">
            <p className="section-lead max-w-md text-muted-foreground">
              Tell us how your organisation works and we’ll show you Bool set up for it. No obligation, just a conversation.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-5">
              <Button size="lg" variant="brand" className={CTA} render={<a href="/contact" />}>
                Let’s talk
                <ButtonArrow className={CTA_ARROW} />
              </Button>
              <a href="mailto:sales@bool.mv" className="text-[15px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
                sales@bool.mv
              </a>
            </div>
          </div>
        </div>
      )}

      {/* the brand and the small print, then Back to top: one ruled bar, its cells filling with
          hexagons on hover as the header's do, and its last cell in amber like the header's Let's talk.
          Below desktop width the cells take a row of their own under the brand; on phones Back to top
          one more, as the four don't fit across */}
      <div className="flex flex-wrap border-t border-border">
        <div className="flex w-full items-center gap-4 gutter py-3 lg:w-auto">
          <Brand className="text-[1.3rem] [&_img]:h-7" />
          <span className="text-[13px] text-muted-foreground">© {new Date().getFullYear()} · Malé, Maldives</span>
        </div>
        <div className="flex w-full flex-wrap border-t border-border sm:flex-nowrap lg:ml-auto lg:w-auto lg:border-t-0">
          <nav aria-label="Legal" className="flex h-14 w-full sm:w-auto sm:flex-3 lg:flex-none">
            {LEGAL.map((l) => (
              <a key={l} href="#" className={`${CELL} flex-1 px-5 first:border-l-0 lg:w-[7.25rem] lg:flex-none lg:first:border-l`}>
                <HexFill />
                <span className={CELL_LABEL}>{l}</span>
              </a>
            ))}
          </nav>
          <a href="#" className={`${CELL} header-cell-accent h-14! w-full border-t border-l-0 px-5 sm:w-auto sm:flex-1 sm:border-t-0 sm:border-l lg:w-[8.5rem] lg:flex-none xl:w-[9.5rem]`}>
            <HexFill />
            <span className={CELL_LABEL}>Back to top</span>
            <ArrowUp className="relative size-4" strokeWidth={1.8} />
          </a>
        </div>
      </div>
    </footer>
  )
}
