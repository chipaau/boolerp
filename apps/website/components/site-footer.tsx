import { ArrowUp } from 'lucide-react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Brand } from './brand'
import { CTA, CTA_ARROW } from './cta'

const LEGAL = ['Privacy', 'Terms', 'Security']

/**
 * The page's close: the last call (the promise and Book a demo), then the brand and Back to top,
 * then the small print. Holds the #contact anchor every call to action points at.
 */
export function SiteFooter() {
  return (
    <footer id="contact" className="relative overflow-hidden border-t border-border/60 bg-background">

      {/* the last call */}
      <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-6 pb-16 pt-20 lg:grid-cols-[1.2fr_1fr] lg:items-end 2xl:max-w-[88rem]">
        <div>
          <p className="text-overline tracking-[0.28em] text-(--brand)">Ready to simplify your operations?</p>
          <h2 className="section-title mt-4 text-foreground">
            Let’s build a workspace <span className="text-(--brand)">that works for you.</span>
          </h2>
        </div>
        <div className="lg:pb-2">
          <p className="section-lead max-w-md text-muted-foreground">
            Tell us how your organisation works and we’ll show you Bool set up for it. No obligation, just a conversation.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <Button size="lg" variant="brand" className={CTA} render={<a href="mailto:sales@bool.mv?subject=Book%20a%20Bool%20demo" />}>
              Book a demo
              <ButtonArrow className={CTA_ARROW} />
            </Button>
            <a href="mailto:sales@bool.mv" className="text-[15px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
              sales@bool.mv
            </a>
          </div>
        </div>
      </div>

      {/* the brand, and Back to top */}
      <div className="relative mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-6 border-t border-border/60 px-6 py-8 2xl:max-w-[88rem]">
        <Brand className="text-[1.5rem]" />
        <Button size="lg" variant="outline" render={<a href="#" />}>
          Back to top
          <ButtonArrow>
            <ArrowUp strokeWidth={2} />
          </ButtonArrow>
        </Button>
      </div>

      {/* the small print */}
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-3 border-t border-border/60 px-6 py-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between 2xl:max-w-[88rem]">
        <span>© {new Date().getFullYear()} Bool · Malé, Maldives</span>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
          {LEGAL.map((l) => (
            <a key={l} href="#" className="transition-colors hover:text-foreground">
              {l}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
