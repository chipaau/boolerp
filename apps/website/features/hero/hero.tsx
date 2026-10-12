import Image from 'next/image'
import { Play } from 'lucide-react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { BeeAirborne, BeeLanded } from './bee'
import { HeroMotion } from './hero-motion'
import { TRUST_AVATARS } from './mock'
import { Tablet } from './tablet'
import { LANDING, PLATFORM, TABLET } from './scene'

// Runs before the hero paints: unless the visitor prefers reduced motion, hold the opening state
// (globals.css: the scene out of focus, the tablet's screen dark, the landed bee and the supporting copy
// waiting) so nothing flashes before the opening starts.
const MOTION_GATE = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.heroMotion='pending'}catch(e){}`

/**
 * The homepage hero. A server component: the platform, the tablet with the real dashboard on its
 * screen, the copy and the landed bee are all in the HTML, finished; HeroMotion (the only client
 * code) plays the opening on top: the scene comes into focus while the bee flies in, and the
 * tablet's screen wakes as it lands.
 *
 * Layers, bottom to top: stage (platform + tablet) · landed bee · copy · flying bee, on the page's
 * cream. The headline and navigation are sharp and readable from the first paint. From lg the scene
 * fills the hero and the copy sits on its calm left side; below lg the copy comes first and the
 * scene is cropped to the tablet and the platform.
 */
export function Hero() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: MOTION_GATE }} />
      <HeroMotion className="relative isolate grid overflow-hidden bg-background">
        <div className="relative order-2 overflow-hidden lg:order-none lg:[grid-area:1/1]">
          <Scene />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-10 pt-28 lg:[grid-area:1/1] lg:self-center lg:pb-0 lg:pt-16">
          <div className="max-w-xl lg:max-w-[34%]">
            <p className="text-overline tracking-[0.28em] text-muted-foreground">One workspace. Multiple apps.</p>
            <h1 className="mt-5 text-balance text-[clamp(2.5rem,4.2vw,4.25rem)] font-light leading-[1.02] tracking-[-0.035em] text-foreground">
              One workspace for everything your team runs.
            </h1>
            <p data-hero-reveal="copy" className="mt-6 max-w-md text-pretty text-[clamp(1.05rem,1.4vw,1.3rem)] leading-snug text-muted-foreground">
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
                  <Image key={i} src={src} alt="" className="size-10 rounded-full object-cover ring-2 ring-background" />
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
 * The stage: the platform with the tablet on it, which the opening brings into focus, and the
 * bee's layer above (kept sharp, outside the focus pull).
 */
function Scene() {
  return (
    <div
      data-hero-scene=""
      className="relative -ml-[50%] aspect-[1672/941] w-[155%] [--bee-w:22cqw] [container-type:inline-size] sm:-ml-[38%] sm:w-[138%] lg:ml-0 lg:w-full"
    >
      <div data-hero-stage="" className="absolute inset-0 will-change-[filter,transform]">
        {/* the room: warm window light and its soft beams, and the brand's hexagons, out of focus */}
        <div aria-hidden="true" className="hero-light absolute inset-0" />
        <Hexagons />
        <Image
          src={PLATFORM.src}
          alt=""
          width={PLATFORM.width}
          height={PLATFORM.height}
          priority
          sizes="(min-width: 1024px) 80vw, 132vw"
          className="absolute h-auto"
          style={{ left: PLATFORM.left, top: PLATFORM.top, width: PLATFORM.size }}
        />
        {/* the window's shadow falling across the plinth, cut to its shape */}
        <div
          aria-hidden="true"
          className="hero-plinth-shade absolute"
          style={{ left: PLATFORM.left, top: PLATFORM.top, width: PLATFORM.size, aspectRatio: `${PLATFORM.width} / ${PLATFORM.height}`, maskImage: `url(${PLATFORM.src})` }}
        />
        <Tablet style={{ left: TABLET.left, top: TABLET.top, ['--tw' as string]: TABLET.size }} />
      </div>
      {/* the bee: landed on the platform, and its flight above everything else in the scene */}
      <div className="pointer-events-none absolute inset-0 z-30">
        <div data-bee-landing-target="" className="absolute" style={LANDING}>
          <BeeLanded />
        </div>
        <BeeAirborne />
      </div>
    </div>
  )
}

/** Three soft hexagons behind the tablet: the brand's honeycomb, out of focus like the background. */
function Hexagons() {
  const hex = 'M50 0 93.3 25v50L50 100 6.7 75V25Z'
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute left-[44%] top-[18%] w-[16cqw] overflow-visible opacity-60 blur-[2px]">
      <path d={hex} fill="none" stroke="rgb(214 170 112 / 0.35)" strokeWidth="1.2" transform="translate(40 -30) scale(0.9)" />
      <path d={hex} fill="rgb(236 196 140 / 0.28)" transform="translate(-8 40) scale(0.75)" />
      <path d={hex} fill="rgb(236 196 140 / 0.2)" transform="translate(30 95) scale(0.65)" />
    </svg>
  )
}
