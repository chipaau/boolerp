'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ChevronDown } from 'lucide-react'
import { HandStroke } from './hand-stroke'

gsap.registerPlugin(useGSAP)

const NAV = [
  { label: 'Product', href: '#product', menu: true },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Resources', href: '#resources' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'About', href: '#about' },
]

/** The bee's size (px wide) and where its feet are (fractions of its frame: the hero's still, 640×520). */
const BEE = { width: 26, feet: { x: 0.5, y: 0.7 } } as const

/**
 * The header's sections. On hover (or keyboard focus) an item darkens and the hero's hand-drawn
 * amber stroke is wiped on under it (CSS, globals.css: .nav-stroke); a small bee comes to rest at
 * the stroke's end and, as the pointer moves to another item, hops along a short arc to that one
 * (a miniature of the hero's flight), turning to face the way it goes. It flies off when the
 * pointer leaves the menu. Reduced motion: the stroke appears without the wipe and the bee does
 * not travel, it is simply there.
 */
export function NavLinks() {
  const nav = useRef<HTMLElement>(null)
  const bee = useRef<HTMLSpanElement>(null)
  const facing = useRef<HTMLSpanElement>(null)
  const perched = useRef(false)
  const { contextSafe } = useGSAP({ scope: nav })

  // stands the bee on the end of `label`'s stroke, hopping there from wherever it is
  const land = contextSafe((label: HTMLElement | null) => {
    const n = nav.current
    const b = bee.current
    if (!label || !n || !b) return
    const r = label.getBoundingClientRect()
    const o = n.getBoundingClientRect()
    const height = (BEE.width * 520) / 640
    const x = r.right - o.left - BEE.width * BEE.feet.x + 2
    const y = r.bottom - o.top - height * BEE.feet.y + 1
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!perched.current || still) {
      perched.current = true
      gsap.set(b, { x, y: still ? y : y - 10 })
      gsap.to(b, { y, autoAlpha: 1, duration: still ? 0 : 0.3, ease: 'power2.out', overwrite: 'auto' })
      return
    }
    const fromX = Number(gsap.getProperty(b, 'x'))
    const fromY = Number(gsap.getProperty(b, 'y'))
    if (Math.abs(x - fromX) < 1) return
    gsap.set(facing.current, { scaleX: x < fromX ? -1 : 1 }) // the still faces right; it turns to the way it hops
    const hop = Math.min(18, 6 + Math.abs(x - fromX) * 0.08)
    gsap.to(b, { x, duration: 0.45, ease: 'power1.inOut', overwrite: 'auto' })
    gsap.to(b, { keyframes: { y: [fromY, Math.min(fromY, y) - hop, y], easeEach: 'sine.inOut' }, duration: 0.45, ease: 'none', overwrite: 'auto' })
  })

  const leave = contextSafe(() => {
    if (!perched.current) return
    perched.current = false
    gsap.to(bee.current, { y: '-=12', autoAlpha: 0, duration: 0.3, ease: 'power2.in', overwrite: 'auto' })
  })

  const labelOf = (e: { currentTarget: HTMLElement }) => e.currentTarget.querySelector<HTMLElement>('[data-nav-label]')

  return (
    <nav ref={nav} aria-label="Main" onPointerLeave={leave} className="relative mx-auto hidden items-center gap-9 text-[15px] text-body lg:flex">
      {NAV.map((item) => (
        <a
          key={item.label}
          href={item.href}
          onPointerEnter={(e) => land(labelOf(e))}
          onFocus={(e) => land(labelOf(e))}
          onBlur={leave}
          className="nav-item group/nav flex items-center gap-1.5 py-2 outline-none transition-colors duration-200 hover:text-foreground focus-visible:text-foreground"
        >
          <span data-nav-label="" className="relative">
            {item.label}
            <HandStroke className="nav-stroke" />
          </span>
          {item.menu && <ChevronDown className="size-4" strokeWidth={1.7} />}
        </a>
      ))}
      <span ref={bee} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 opacity-0" style={{ width: BEE.width }}>
        <span ref={facing} className="block">
          {/* a 26px still the hero has already loaded */}
          <img src="/hero/bee/bee-rest.webp" alt="" width={640} height={520} className="block h-auto w-full select-none" draggable={false} />
        </span>
      </span>
    </nav>
  )
}
