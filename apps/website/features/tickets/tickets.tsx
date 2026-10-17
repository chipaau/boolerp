'use client'

import { useId, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * The solution profiles, as tickets. Illustrative profiles, not price plans. `back` is the orange
 * face's wording (after the designed backs in public/bool-ticket-assets), `front` the cream face's.
 */
const TICKETS: {
  id: string
  n: string
  name: string
  body: string
  points: string[]
  stub: string
  caption: string
  back: { lines: [string, string]; foot: [string, string] }
}[] = [
  {
    id: 'core',
    n: '01',
    name: 'Core',
    body: 'For teams getting operations under control. Start with the essentials, without unnecessary complexity.',
    points: ['Inventory and asset tracking', 'Core request workflows', 'Clear operational visibility'],
    stub: 'Start with clarity',
    caption: 'A solid foundation for your operations',
    back: { lines: ['Essential operations', 'for real teams'], foot: ['Built to keep', 'your operations moving'] },
  },
  {
    id: 'growth',
    n: '02',
    name: 'Growth',
    body: 'For teams coordinating more people, requests and purchasing. A connected workspace that reduces friction as you grow.',
    points: ['Connected workflows and approvals', 'Purchasing and receiving', 'Better visibility across teams'],
    stub: 'Connect your operations',
    caption: 'Tailored to your team and scale',
    back: { lines: ['Connected workflows', 'for growing operations'], foot: ['Designed to', 'reduce friction'] },
  },
  {
    id: 'scale',
    n: '03',
    name: 'Scale',
    body: 'For larger or multi-site operations that need stronger control, reporting and room to grow.',
    points: ['Multi-team workflows', 'Broader reporting and insights', 'Tailored rollout and support'],
    stub: 'Built for complexity',
    caption: 'A scalable solution for what’s next',
    back: { lines: ['Greater visibility', 'for complex operations'], foot: ['Built to support', 'what comes next'] },
  },
]

type Ticket = (typeof TICKETS)[number]

/**
 * The ticket's shape, shared by both faces: 524 × 740 (the designed backs' ticket width, shortened),
 * its perforation 548 down, with a notch either side.
 */
const W = 524
const H = 740
const CUT = 548
const OUTLINE = `M20 0 H${W - 20} Q${W} 0 ${W} 20 V${CUT - 27} Q${W - 25} ${CUT - 23} ${W - 25} ${CUT} Q${W - 25} ${CUT + 24} ${W} ${CUT + 28} V${H - 22} Q${W} ${H} ${W - 22} ${H} H22 Q0 ${H} 0 ${H - 22} V${CUT + 28} Q25 ${CUT + 24} 25 ${CUT} Q25 ${CUT - 23} 0 ${CUT - 27} V20 Q0 0 20 0 Z`

/** A pointy-top hexagon of radius r centred at (x, y), as a path. */
const hex = (x: number, y: number, r: number) => {
  const p = Array.from({ length: 6 }, (_, k) => {
    const a = ((-90 + 60 * k) * Math.PI) / 180
    return `${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}`
  })
  return `M${p.join(' L')} Z`
}
/** Three hexagons that tessellate: two side by side and one nested below between them. */
const cluster = (x: number, y: number, r: number) => {
  const w = Math.sqrt(3) * r
  return [hex(x, y, r), hex(x + w, y, r), hex(x + w / 2, y + 1.5 * r, r)]
}

/** A small, fixed pattern of squares (a decorative mark, not a scannable code). */
const MARK = [
  [0, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 1, 0, 1, 0],
  [0, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 1, 1, 1, 0],
  [1, 1, 0, 1, 0, 0, 1],
  [0, 1, 1, 0, 1, 1, 0],
  [1, 0, 1, 1, 0, 1, 1],
]

/** The orange face, drawn in the page (so it is set in the site's Lato). */
function Back({ t }: { t: Ticket }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block size-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`amber-${id}`} x1="0" x2="1" y1="0.9" y2="0.15">
          <stop offset="0" stopColor="#B96017" />
          <stop offset="0.52" stopColor="#D7791D" />
          <stop offset="1" stopColor="#F1982B" />
        </linearGradient>
        <linearGradient id={`shine-${id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#F9B65C" stopOpacity=".26" />
          <stop offset=".45" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#8A3E14" stopOpacity=".11" />
        </linearGradient>
        <clipPath id={`ticket-${id}`}>
          <path d={OUTLINE} />
        </clipPath>
      </defs>
      <path d={OUTLINE} fill={`url(#amber-${id})`} />
      <g clipPath={`url(#ticket-${id})`}>
        <path d={OUTLINE} fill={`url(#shine-${id})`} />
        <path d="M-14 12 Q207 -28 529 52" fill="none" stroke="#FFD094" opacity=".55" strokeWidth="2" />
        {/* a faint honeycomb, large, behind the name */}
        <g stroke="#FFE8C7" strokeWidth="1.6" fill="none" opacity=".16">
          {cluster(332, 190, 58).map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <path d={`M-9 ${CUT} H${W + 9}`} stroke="#FFE9C6" strokeWidth="2" strokeDasharray="11 8" opacity=".8" />
      </g>
      <path d={OUTLINE} fill="none" stroke="#FFC37A" strokeWidth="1.5" opacity=".53" />
      <g fill="#FFF3DD">
        {MARK.flatMap((row, y) => row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={49 + x * 10} y={48 + y * 10} width="7" height="7" rx="0.5" /> : null)))}
      </g>
      <g stroke="#FFF3DD" strokeWidth="1.7" opacity=".87" fill="none">
        <circle cx="432" cy="84" r="12" />
        <path d="M432 61 V107 M409 84 H455" />
      </g>
      <g fill="#FFF3DD" fontFamily="inherit">
        <text x="488" y="91" fontSize="20" textAnchor="end" letterSpacing="2" fontWeight="700">
          {t.n}
        </text>
        <text x="50" y="158" fontSize="15" letterSpacing="4" fontWeight="700">
          BOOL / {t.name.toUpperCase()}
        </text>
        <text x="47" y="352" fontSize="82" fontWeight="300" letterSpacing="-2" fill="#FFF5E7">
          {t.name}
        </text>
      </g>
      {/* the honeycomb mark: three cells that fit together */}
      <g fill="none" stroke="#FFEBD3" strokeWidth="2.1" opacity=".93">
        {cluster(404, 366, 32).map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path d="M48 438 H476" fill="none" stroke="#FFE9CC" opacity=".85" strokeWidth="1.35" />
      <g fill="#FFF3DE" fontFamily="inherit" fontSize="17" letterSpacing="2.4" fontWeight="700">
        <text x="48" y="478">{t.back.lines[0].toUpperCase()}</text>
        <text x="48" y="508">{t.back.lines[1].toUpperCase()}</text>
      </g>
      <path d="M50 632 L64 644 L50 656 M69 632 L83 644 L69 656 M88 632 L102 644 L88 656" fill="none" stroke="#FFF3DE" strokeWidth="3" opacity=".9" />
      <g fill="#FFF3DE" fontFamily="inherit" fontSize="15" letterSpacing="2.2" fontWeight="700" textAnchor="end">
        <text x="478" y="640">{t.back.foot[0].toUpperCase()}</text>
        <text x="478" y="668">{t.back.foot[1].toUpperCase()}</text>
      </g>
    </svg>
  )
}

/** A barcode's bars (relative widths), the same on every render. */
const BARS = Array.from({ length: 38 }, (_, k) => 1 + ((k * 7 + (k % 3) * 5) % 4))

/**
 * The cream face, in two parts cut at the perforation: the ticket, and its stub. Pointing at the
 * barcode tears the stub along the perforation so it hangs from its left corner, and the barcode
 * becomes the way in: one solid button in the barcode's own place, in the site's call-to-action
 * colour.
 */
function Front({ t }: { t: Ticket }) {
  return (
    <div className="ticket-front h-full">
      <div className="ticket-body">
        {/* very faded honeycomb along the ticket's right edge */}
        <svg aria-hidden="true" viewBox="0 0 220 420" className="pointer-events-none absolute right-0 top-[4%] h-[66%] w-auto">
          <g fill="rgb(240 154 67)" fillOpacity="0.045" stroke="rgb(240 154 67)" strokeOpacity="0.07" strokeWidth="1">
            {[hex(190, 110, 76), hex(124, 224, 76), hex(190, 338, 76)].map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </svg>
        <div className="relative flex h-full flex-col justify-between px-[9%] pb-[9%] pt-[10%]">
          <div>
            <h3 className="text-[clamp(2rem,2.7vw,2.5rem)] font-light leading-none tracking-[-0.03em] text-foreground">{t.name}</h3>
            <p className="card-body mt-[7%] max-w-[90%] text-foreground/75">{t.body}</p>
          </div>
          <ul className="grid gap-2.5">
            {t.points.map((p) => (
              <li key={p} className="card-body flex items-center gap-2.5 text-foreground">
                {/* a small amber hexagon for a bullet */}
                <svg aria-hidden="true" viewBox="-10 -10 20 20" className="size-3 shrink-0">
                  <path d={hex(0, 0, 9)} fill="var(--brand-soft)" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <a href="/contact" className="ticket-stub group/stub outline-none" aria-label={`${t.name}: let’s talk about Bool`}>
        <span className="flex h-full flex-col justify-center px-[8%]">
          <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-(--brand)">
            {t.stub}
            <ArrowRight className="size-3.5" />
          </span>
          {/* the barcode, and the button that takes its exact place */}
          <span className="relative mt-[4%] block h-[clamp(34px,3.4vw,46px)]">
            <span aria-hidden="true" className="ticket-bars absolute inset-0 flex items-stretch gap-[2px]">
              {BARS.map((w, k) => (
                <span key={k} style={{ flexGrow: w }} />
              ))}
            </span>
            <span className="ticket-button absolute inset-0 flex items-center justify-center gap-2 text-[14px] font-bold text-white">
              Let’s talk about Bool
              <ArrowRight className="size-4 text-(--brand-soft)" />
            </span>
          </span>
          <span className="mt-[4%] block text-[10px] font-bold uppercase tracking-[0.14em] text-(--brand)/80">{t.caption}</span>
        </span>
      </a>
    </div>
  )
}

/** One ticket: the orange back and the cream front on the two sides of a card that turns over. */
function TicketCard({ t }: { t: Ticket }) {
  return (
    <div data-ticket={t.id} className="ticket [perspective:1600px]">
      <div data-ticket-turn="" className="ticket-turn relative aspect-[524/740] [container-type:inline-size]">
        <div className="ticket-face absolute inset-0">
          <Front t={t} />
        </div>
        <div className="ticket-face ticket-side-back absolute inset-0">
          <Back t={t} />
        </div>
      </div>
    </div>
  )
}

/**
 * "Our solutions": three tickets. On desktop the section is pinned under its big heading, and as the
 * visitor scrolls the tickets fly up from below the screen one after another, their orange backs
 * towards the viewer and tilted, turning over in 3D as they come until each lands face up and
 * square beside the last, in the middle of the screen, while the big heading rises and settles at
 * the top as the section's title. Follows the scroll both ways.
 * Below lg, and with reduced motion, the three fronts side by side (or stacked).
 */
export function Tickets() {
  const section = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const q = gsap.utils.selector(section)
        const tickets = q('[data-ticket]')
        const turns = q('[data-ticket-turn]')
        const tl = gsap.timeline({ defaults: { ease: 'none' } })
        tl.set(tickets, { autoAlpha: 1 }, 0)
        tickets.forEach((ticket, i) => {
          const side = i - 1 // -1, 0, 1
          const at = i * 0.55
          // up from below the screen, swinging in from its side and settling square
          tl.fromTo(
            ticket,
            { y: () => innerHeight * 0.95, x: side * 60, rotation: side * 14 - 6, scale: 0.9 },
            { y: 0, x: 0, rotation: 0, scale: 1, duration: 1, ease: 'power2.out' },
            at,
          )
          // and over, from its back to its front, with a little lean as it turns
          tl.fromTo(turns[i], { rotationY: -180, rotationX: 18 }, { rotationY: 0, rotationX: 0, duration: 1, ease: 'power1.inOut' }, at + 0.05)
        })
        // the big heading rises to the top of the screen and settles there as the section's title,
        // small and still readable, while the tickets come up beneath it
        tl.to(q('[data-tickets-heading]'), { y: () => -innerHeight * 0.39, scale: 0.42, duration: 1.1, ease: 'power2.inOut' }, 0)
        // (its small label would shrink past reading: it goes)
        tl.to(q('[data-tickets-heading] p'), { autoAlpha: 0, duration: 0.4 }, 0)
        // and as they come, the orange fades away completely into the page's cream, the title turning
        // back to the page's dark and orange with it
        tl.to(q('[data-tickets-cream]'), { autoAlpha: 1, duration: 1.2, ease: 'sine.inOut' }, 0.15)
          .to(q('[data-tickets-heading] h2'), { color: 'var(--foreground)', textShadow: '0 0 0 rgb(0 0 0 / 0)', duration: 1.2, ease: 'sine.inOut' }, 0.15)
          .to(q('[data-tickets-heading] h2 span'), { color: 'var(--brand)', duration: 1.2, ease: 'sine.inOut' }, 0.15)

        // the section sits under Deploy, top to top (Deploy lies on it like a sheet of paper, globals.css
        // .deploy-sheet; --deploy-h, its height, sets how far up it tucks), and is held still from
        // there: scrolling first lifts Deploy away to uncover the orange, then plays the tickets
        const root = document.documentElement
        const deploy = document.getElementById('deployment')
        const lift = () => deploy?.offsetHeight ?? innerHeight
        const tuck = () => root.style.setProperty('--deploy-h', `${lift()}px`)
        tuck()
        const watch = new ResizeObserver(() => {
          tuck()
          ScrollTrigger.refresh()
        })
        if (deploy) watch.observe(deploy)
        const pin = ScrollTrigger.create({
          trigger: section.current,
          start: 'top top',
          end: () => `+=${lift() + innerHeight * 1.9}`,
          pin: true,
          invalidateOnRefresh: true,
          onToggle: (self) => document.documentElement.toggleAttribute('data-pinned', self.isActive),
        })
        const play = ScrollTrigger.create({
          start: () => pin.start + lift(),
          end: () => pin.end,
          scrub: 1,
          animation: tl,
          invalidateOnRefresh: true,
        })
        return () => {
          watch.disconnect()
          play.kill()
          pin.kill()
          root.style.removeProperty('--deploy-h')
        }
      })
      return () => mm.revert()
    },
    { scope: section },
  )

  return (
    <section ref={section} id="solutions" className="tickets-field relative z-0 overflow-hidden lg:motion-safe:-mt-[calc(var(--deploy-h,100svh)-2px)] lg:motion-safe:h-svh">

      {/* the cream (and the drafting paper) the orange fades into as the tickets come */}
      <div data-tickets-cream="" aria-hidden="true" className="invisible absolute inset-0 bg-background opacity-0">
        <div className="office-grid absolute inset-0" />
      </div>
      {/* the heading, large, in the middle of the screen (the tickets fly over it) */}
      <div data-tickets-heading="" className="relative z-0 mx-auto max-w-5xl gutter pt-24 text-center lg:motion-safe:absolute lg:motion-safe:inset-x-0 lg:motion-safe:top-1/2 lg:motion-safe:-translate-y-1/2 lg:motion-safe:pt-0">
        <p className="text-overline tracking-[0.28em] text-white/80">Our solutions</p>
        <h2 className="mt-5 text-balance text-[clamp(2.75rem,6.4vw,6.5rem)] font-light leading-[0.98] tracking-[-0.04em] text-white [text-shadow:0_2px_24px_rgb(150_70_10/0.25)]">
          Start where you are, <span className="text-[#fff1dc]">grow from there.</span>
        </h2>
      </div>

      {/* the tickets */}
      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center justify-items-center gap-8 gutter py-16 lg:grid-cols-3 lg:gap-6 lg:motion-safe:h-full lg:motion-safe:pb-0 lg:motion-safe:pt-[12svh]">
        {TICKETS.map((t) => (
          <div key={t.id} className="w-full max-w-[min(21rem,calc((100svh-12rem)*524/740))] lg:motion-safe:[&>[data-ticket]]:invisible">
            <TicketCard t={t} />
          </div>
        ))}
      </div>

    </section>
  )
}
