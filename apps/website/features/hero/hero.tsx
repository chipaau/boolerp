import Image from 'next/image'
import { Play } from 'lucide-react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Hexagon } from '@workspace/ui/components/hexagon'
import { BeeAirborne, BeeLanded, BeeTrail } from './bee'
import { HeroMotion } from './hero-motion'
import { TRUST_AVATARS } from './mock'
import { Tablet } from './tablet'
import { LANDING } from './scene'

// Runs before the hero paints: unless the visitor prefers reduced motion, hold the opening state
// (globals.css: the tablet out of focus, the landed bee and the supporting copy waiting) so nothing
// flashes before the opening starts.
const MOTION_GATE = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.heroMotion='pending'}catch(e){}`

/**
 * The homepage hero. A server component: the tablet with the real dashboard on its screen, the copy
 * and the landed bee are all in the HTML, finished; HeroMotion (the only client code) plays the
 * opening on top: the bee flies in and lands on the tablet's bottom edge as the tablet comes into focus.
 *
 * Layers, bottom to top: glow · copy · tablet and landed bee · trail and flying bee, on the page's cream. The
 * headline and navigation are sharp and readable from the first paint. From lg the scene fills the
 * hero and the copy sits on its calm left side; below lg the copy comes first and the scene is
 * cropped to the tablet. From 2xl (large monitors) the page's content column widens from 80rem to
 * 88rem, with the header, and the scene and type grow with it.
 */
export function Hero() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: MOTION_GATE }} />
      <HeroMotion className="relative isolate grid overflow-hidden bg-background">
        <div className="relative order-2 overflow-hidden lg:order-none lg:flex lg:items-center lg:[grid-area:1/1]">
          <Scene />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 2xl:max-w-[88rem] pb-10 pt-24 lg:[grid-area:1/1] lg:self-center lg:py-0 lg:pt-20">
          <div className="max-w-xl lg:max-w-[36%]">
            <p className="text-overline tracking-[0.28em] text-muted-foreground">One workspace. Multiple apps.</p>
            <h1 className="mt-5 text-balance text-[clamp(2.25rem,3.1vw,3.75rem)] font-light leading-[1.02] tracking-[-0.035em] text-foreground">
              One workspace for{' '}
              <span className="relative inline-block">
                everything
                {/* a hand-drawn amber stroke, wiped on from left to right as the bee passes over */}
                <svg data-hero-underline="" aria-hidden="true" viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute -bottom-[0.14em] left-0 h-[0.28em] w-full overflow-visible">
                  <path d="M3 13 C 52 5, 118 3, 197 9" fill="none" stroke="var(--brand-soft)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </span>{' '}
              your team runs.
            </h1>
            <p data-hero-reveal="copy" className="mt-6 max-w-md text-pretty text-[clamp(1rem,1.2vw,1.25rem)] leading-snug text-muted-foreground">
              Tasks, inventory, assets, procurement, notes and analytics. Connected in one workspace.
            </p>
            <div data-hero-reveal="cta" className="mt-9 flex flex-wrap items-center gap-3">
              <Button size="lg" render={<a href="#get-started" />}>
                Get started
                <ButtonArrow />
              </Button>
              <Button size="lg" variant="outline" render={<a href="#how-it-works" />}>
                <span className="grid size-7 place-items-center rounded-full bg-card">
                  <Play className="size-3.5 fill-current" />
                </span>
                See how it works
              </Button>
            </div>
            <div data-hero-reveal="copy" className="mt-10 flex items-center gap-5">
              <span className="flex -space-x-2.5">
                {TRUST_AVATARS.map((src, i) => (
                  <Image key={i} src={src} alt="" sizes="40px" className="size-10 rounded-full object-cover ring-2 ring-background" />
                ))}
              </span>
              <span className="border-l border-border pl-5 text-sm leading-snug text-muted-foreground">
                Trusted by teams across
                <br />
                operations, finance and procurement.
              </span>
            </div>
          </div>
        </div>

      </HeroMotion>
    </>
  )
}

/**
 * The stage: the tablet floating in a warm glow, brought into focus by the opening, with the landed
 * bee on its edge, both in one layer that leans gently toward the pointer once the opening is done;
 * above them the flying bee and its trail (kept sharp, outside the focus pull).
 */
function Scene() {
  return (
    <div
      data-hero-scene=""
      className="relative -ml-[59%] aspect-[1398/820] w-[155%] [--bee-w:15cqw] [container-type:inline-size] sm:-ml-[51%] sm:w-[138%] lg:mx-auto lg:w-[min(calc(100%-3rem),77rem)] 2xl:w-[min(calc(100%-3rem),85rem)]"
    >
      {/* the soft light the tablet floats in, gathered in the brand's hexagon behind it */}
      <div aria-hidden="true" className="hero-glow absolute" />
      <Hexagon size="34cqw" className="absolute left-[53.7%] top-[25.9%] text-hex-decor-to opacity-70 blur-[2.5cqw]" />
      <div data-hero-tilt="" className="pointer-events-none absolute inset-0 z-30 origin-[70.1%_54.9%]">
        <Tablet focus="soft" />
        <Tablet focus="sharp" />
        <div data-bee-landing-target="" className="absolute" style={LANDING}>
          <BeeLanded />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 z-30">
        <BeeTrail />
        <BeeAirborne />
      </div>
    </div>
  )
}
