import Image from 'next/image'
import { Play } from 'lucide-react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Bee } from './bee'
import { HeroMotion } from './hero-motion'
import { TRUST_AVATARS } from './mock'
import { DASHBOARD, LANDING, SCENE, SCREEN } from './scene'

// Runs before the hero paints: unless the visitor prefers reduced motion, hold the opening state
// (globals.css) so nothing flashes before the flight starts.
const MOTION_GATE = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.heroMotion='pending'}catch(e){}`

/**
 * The homepage hero. A server component: the photo, the real dashboard on its screen, the copy and
 * the landed bee are all in the HTML; HeroMotion (the only client code) adds the opening on top.
 *
 * Layers, bottom to top, all in one stacking context so the bee can multiply onto the photo:
 * scene (photo + dashboard) · copy · focus (the soft blur the opening pulls away) · bee.
 * From lg the scene fills the hero and the copy sits on its calm left side; below lg the copy
 * comes first and the scene is cropped to the laptop and the stone.
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

        {/* the out-of-focus veil the opening pulls away; invisible unless the opening is pending */}
        <div
          data-hero-focus=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 bg-background/15 opacity-0 backdrop-blur-[14px]"
        />
      </HeroMotion>
    </>
  )
}

/** The photograph with the product on its screen and the bee's layer above. */
function Scene() {
  return (
    <div
      data-hero-scene=""
      className="relative -ml-[62%] aspect-[1672/941] w-[165%] [--bee-w:17cqw] [container-type:inline-size] sm:-ml-[45%] sm:w-[145%] lg:ml-0 lg:w-full"
    >
      <Image src={SCENE.src} alt="" width={SCENE.width} height={SCENE.height} priority sizes="(min-width: 1024px) 100vw, 165vw" className="absolute inset-0 size-full" />
      <div
        data-hero-reveal="dashboard"
        className="absolute aspect-[16/10] origin-top-left overflow-hidden rounded-[0.3cqw]"
        style={{ left: SCREEN.left, top: SCREEN.top, width: SCREEN.width, transform: SCREEN.transform }}
      >
        <Image src={DASHBOARD.src} alt="The Bool workspace home" width={DASHBOARD.width} height={DASHBOARD.height} sizes="40vw" className="size-full object-cover object-top" />
      </div>
      {/* the bee multiplies onto the photo, so the clips' white falls away */}
      <div className="pointer-events-none absolute inset-0 z-30 mix-blend-multiply">
        <div data-bee-landing-target="" className="absolute" style={LANDING}>
          <Bee />
        </div>
      </div>
    </div>
  )
}
