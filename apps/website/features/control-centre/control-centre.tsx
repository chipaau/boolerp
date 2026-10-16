import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { CTA, CTA_ARROW } from '@/components/cta'
import { Fragments } from './fragments'
import { Ripple } from './ripple'
import { Tour } from './tour'

/**
 * The Control Centre's page: the record every Bool app reads. The hero shows pieces of what it does
 * (not its screens); then a tour of five things it does, told by the scroll; then one change running
 * out to the apps.
 */
export function ControlCentre() {
  return (
    <>
      {/* the hero, on the home page's drafting paper */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="office-grid grid-fade-top pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-6 pb-24 pt-28 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:pt-36 2xl:max-w-[88rem]">
          <div>
            <p className="text-overline tracking-[0.28em] text-muted-foreground">Control Centre</p>
            <h1 className="mt-4 text-[clamp(2.5rem,3.9vw,3.6rem)] font-light leading-[1.05] tracking-[-0.035em] text-foreground">
              The record
              <br />
              <span className="whitespace-nowrap text-(--brand)">every app reads.</span>
            </h1>
            <p className="section-lead mt-6 max-w-md text-muted-foreground">Set up your organisation once. Change it here, and it lands everywhere.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" variant="brand" className={CTA} render={<a href="/contact" />}>
                Let’s talk
                <ButtonArrow className={CTA_ARROW} />
              </Button>
              <Button size="lg" variant="outline" render={<a href="/#workspace" />}>
                See every app
              </Button>
            </div>
          </div>
          <Fragments />
        </div>
      </section>

      <Tour />

      <Ripple />

    </>
  )
}
