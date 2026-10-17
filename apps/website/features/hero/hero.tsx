import Image from 'next/image'
import { Play } from 'lucide-react'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { HexGlyph } from '@workspace/ui/components/hex-glyph'
import { Hexagon } from '@workspace/ui/components/hexagon'
import { CTA, CTA_ARROW } from '@/components/cta'
import { BeeAirborne, BeeLanded, BeeTrail } from './bee'
import { HeroMotion } from './hero-motion'
import { TRUST_AVATARS } from './mock'
import { Tablet } from './tablet'
import { HeroToasts } from './toasts'
import { CHAPTERS } from './demo'
import { LANDING } from './scene'

// Runs before the hero paints: unless the visitor prefers reduced motion, hold the opening state
// (globals.css: the tablet out of focus, the landed bee and the supporting copy waiting) so nothing
// flashes before the opening starts.
// A reload starts at the hero: the page's pinned sections are only laid out once the scripts run, so
// a restored scroll position lands somewhere else (inside the scroll story, often), not where it was
const MOTION_GATE = `try{if(!location.hash){history.scrollRestoration='manual';scrollTo(0,0)}}catch(e){}try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.heroMotion='pending'}catch(e){}`

/**
 * The homepage hero. A server component: the tablet with the real dashboard on its screen, the copy
 * and the landed bee are all in the HTML, finished; HeroMotion (the only client code) plays the
 * opening on top: the bee flies in and lands on the tablet's bottom edge as the tablet comes into focus.
 *
 * Layers, bottom to top: glow · copy · tablet and landed bee · trail and flying bee, on the page's cream. The
 * headline and navigation are sharp and readable from the first paint. From lg the hero is at
 * least the screen's height (the scroll story pins it), the scene fills it and the copy sits on its
 * calm left side; below lg the copy comes first and the scene is cropped to the tablet. From 2xl (large monitors) the page's content column widens from 80rem to
 * 88rem, with the header, and the scene and type grow with it.
 */
export function Hero() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: MOTION_GATE }} />
      <HeroMotion className="relative isolate grid overflow-hidden bg-background lg:min-h-svh">
        {/* the drafting paper the next section is drawn on, under the hero too */}
        <div aria-hidden="true" className="office-grid grid-fade-top pointer-events-none absolute inset-0 -z-10" />
        {/* the scroll story's room: dark grey behind the playing tablet, faded in as it comes forward (story.ts) */}
        <div data-story-backdrop="" aria-hidden="true" className="pointer-events-none invisible fixed inset-0 -z-10 bg-surface-inverted opacity-0">
          {/* the drafting paper the next section is drawn on, here in light lines */}
          <div className="office-grid-dark absolute inset-0" />
        </div>
        <div id="demo" className="relative order-2 overflow-hidden lg:order-none lg:flex lg:items-center lg:[grid-area:1/1]">
          <Scene />
        </div>

        <div data-story-fade="" className="relative z-10 mx-auto w-full max-w-7xl gutter 2xl:max-w-[88rem] pb-10 pt-24 lg:[grid-area:1/1] lg:self-center lg:py-0 lg:pt-4">
          <div className="max-w-xl lg:max-w-[38%]">
            <p className="text-overline tracking-[0.28em] text-muted-foreground">One workspace. Multiple apps.</p>
            <h1 className="mt-4 text-balance text-[clamp(2.5rem,min(3.9vw,7svh),4.75rem)] font-light leading-[1.02] tracking-[-0.035em] text-foreground">
              One workspace for everything your team runs.
            </h1>
            <p data-hero-reveal="copy" className="mt-6 max-w-lg text-pretty text-[clamp(1.0625rem,min(1.35vw,2.45svh),1.375rem)] leading-snug text-muted-foreground">
              Tasks, inventory, assets, procurement, notes and analytics. Connected in one workspace.
            </p>
            <div data-hero-reveal="cta" className="mt-9 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
              <Button size="lg" variant="brand" className={`${CTA} max-sm:w-full max-sm:justify-between`} render={<a href="/contact?topic=demo" />}>
                Book a demo
                <ButtonArrow className={CTA_ARROW} />
              </Button>
              {/* the demo itself: on desktop it glides into the scroll story (story.ts), on phones down to the recording */}
              <Button size="lg" variant="outline" data-story-tour="" className="max-sm:w-full max-sm:justify-between" render={<a href="#demo" />}>
                See it in action
                {/* just the play mark, outlined in the muted grey, filling in on hover */}
                <Play className="size-4 text-muted-foreground transition-[color,fill] duration-200 group-hover/btn:fill-current group-hover/btn:text-foreground" strokeWidth={1.8} />
              </Button>
            </div>
            {/* who uses it: a few faces and the teams they come from */}
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

        <ScrollCue />
        <StoryCaptions />
        <StoryCta />
        <CompactCaptions />
      </HeroMotion>
    </>
  )
}

/**
 * The stage: from lg it is the content column, or larger where the screen is tall enough for it, so
 * the tablet fills the height under the header (about 80% of it) rather than leaving the first view
 * half empty on a laptop; it never outgrows the window and stops at 108rem. It is raised so the
 * tablet (in the stage's lower part) is centred under the header rather than the stage itself.
 *
 * The tablet floating in a warm glow, brought into focus by the opening, with the landed
 * bee on its edge, both in one layer that leans gently toward the pointer once the opening is done;
 * above them the flying bee and its trail (kept sharp, outside the focus pull).
 */
function Scene() {
  return (
    <div
      data-hero-scene=""
      className="relative -ml-[63%] -mt-[8%] -mb-[12%] aspect-[1398/820] w-[144%] sm:my-0 [--bee-w:15cqw] [container-type:inline-size] sm:-ml-[51%] sm:w-[138%] lg:mx-auto lg:w-[max(min(calc(100%-3rem),77rem),min(calc((100svh-6rem)*1.98),calc(100vw-1rem),108rem))] lg:translate-y-[calc(0.5rem-7.5%)] 2xl:w-[max(min(calc(100%-3rem),85rem),min(calc((100svh-6rem)*1.98),calc(100vw-1rem),108rem))]"
    >
      {/* the soft light the tablet floats in, gathered in the brand's hexagon behind it */}
      <div data-story-fade="" aria-hidden="true" className="hero-glow absolute" />
      <Hexagon data-story-fade="" size="34cqw" className="absolute left-[53.7%] top-[25.9%] text-hex-decor-to opacity-70 blur-[2.5cqw]" />
      <div data-hero-tilt="" className="pointer-events-none absolute inset-0 z-30 origin-[70.1%_54.9%]">
        <Tablet focus="soft" />
        <Tablet focus="sharp" />
        <div data-bee-landing-target="" className="absolute" style={LANDING}>
          <BeeLanded />
        </div>
      </div>
      <HeroToasts />
      <div className="pointer-events-none absolute inset-0 z-30">
        <BeeTrail />
        <BeeAirborne />
      </div>
    </div>
  )
}

/**
 * At the foot of the first view (the window's, since the hero can be a little taller), centred: a small amber hexagon running down a hairline under the words,
 * to say the hero goes on; clicked, it glides into the story (story.ts). It goes as the story
 * starts; desktop only.
 */
function ScrollCue() {
  return (
    <div data-story-fade="" className="pointer-events-none absolute inset-x-0 top-[calc(100svh-5.75rem)] z-20 hidden justify-center lg:flex">
      <button
        type="button"
        data-scroll-cue=""
        data-story-tour=""
        data-hero-reveal="copy"
        className="group pointer-events-auto flex flex-col items-center gap-3 rounded-full px-4 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-overline tracking-[0.28em] text-muted-foreground transition-colors group-hover:text-foreground">Scroll to explore</span>
        <span aria-hidden="true" className="relative h-10 w-px bg-foreground/15">
          <HexGlyph size={7} className="scroll-cue-drop absolute -left-[3px] top-0 text-(--brand-soft)" />
        </span>
      </button>
    </div>
  )
}

/**
 * The scroll story's captions (story.ts): one per chapter of the product demo, as plain light text
 * on the dark room under the settled tablet (placed from the screen's height: the hero is pinned at
 * the top), with a short progress bar. Hidden until the story reaches them; desktop only.
 */
function StoryCaptions() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[88svh] z-40 hidden gutter lg:block">
      {/* plain text on the dark room under the tablet, like subtitles under a screen: nothing over the product */}
      <div data-story-captions="" className="invisible mx-auto grid w-full max-w-4xl justify-items-center text-center opacity-0">
        {CHAPTERS.map((c) => (
          <p key={c.id} data-story-caption="" className="invisible text-[1.0625rem] opacity-0 [grid-area:1/1]">
            {/* light on the story's dark backdrop */}
            <span className="font-medium text-surface-inverted-foreground">{c.title}.</span> <span className="text-surface-inverted-foreground/65">{c.body}</span>
          </p>
        ))}
        {/* the chapters as hairlines, the current one wider and filling as it plays */}
        <div aria-hidden="true" className="mt-3 flex items-center gap-1.5">
          {CHAPTERS.map((c) => (
            <span key={c.id} data-story-dot="" className="relative h-[3px] w-4 overflow-hidden rounded-full bg-surface-inverted-foreground/15">
              <span className="absolute inset-0 origin-left scale-x-0 rounded-full bg-(--brand-soft)" />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * The story's close (story.ts): as the tablet steps back into the hero, one next step comes in
 * under it: having just watched the product, a demo of it for their own institution. Hidden until
 * then; desktop only.
 */
function StoryCta() {
  return (
    <div data-story-cta="" className="invisible absolute inset-x-0 top-[89%] z-40 hidden justify-center opacity-0 lg:flex">
      <Button size="lg" variant="brand" className={CTA} render={<a href="/contact?topic=demo" />}>
        Book a demo
        <ButtonArrow className={CTA_ARROW} />
      </Button>
    </div>
  )
}

/**
 * Phones and tablets: one line under the scene naming the chapter the recording is in (story.ts,
 * compactStory). Hidden until the recording plays.
 */
function CompactCaptions() {
  return (
    <p data-compact-captions="" className="invisible order-3 mx-auto -mt-2 max-w-md gutter pb-10 text-center text-sm opacity-0 lg:hidden">
      {CHAPTERS.map((c, i) => (
        <span key={c.id} data-compact-caption="" hidden={i > 0}>
          <span className="font-medium text-foreground">{c.title}.</span> <span className="text-muted-foreground">{c.body}</span>
        </span>
      ))}
    </p>
  )
}
