import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import logo from '@workspace/assets/logos/bool-logo.png'
import { Button } from '@workspace/ui/components/button'
import { CTA } from './cta'
import { HeaderMotion } from './header-motion'

const NAV = [
  { label: 'Product', href: '#product', menu: true },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Resources', href: '#resources' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'About', href: '#about' },
]

/**
 * The site's top bar: brand, sections, and the ways in. Sign in is always there; Get started joins
 * it once the hero's own buttons have scrolled away, so the page never offers two at once
 * (HeaderMotion, which also moves the bar aside while the visitor scrolls down).
 */
export function SiteHeader({ className }: { className?: string }) {
  return (
    <HeaderMotion className={className}>
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-8 px-6 2xl:max-w-[88rem]">
        <a href="/" className="flex items-center gap-2.5 text-[1.6rem] font-bold tracking-[-0.03em] text-foreground">
          <Image src={logo} alt="" priority className="h-9 w-auto" />
          Bool
        </a>
        <nav aria-label="Main" className="mx-auto hidden items-center gap-9 text-[15px] text-body lg:flex">
          {NAV.map((item) => (
            <a key={item.label} href={item.href} className="flex items-center gap-1.5 transition-colors hover:text-foreground">
              {item.label}
              {item.menu && <ChevronDown className="size-4" strokeWidth={1.7} />}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center lg:ml-0">
          <Button render={<a href="#sign-in" />}>
            Sign in
          </Button>
          {/* hidden (and inert) while the hero's buttons are on screen */}
          <span
            data-header-cta=""
            className="-my-2 grid max-w-0 overflow-hidden py-2 opacity-0 transition-[max-width,opacity,margin] duration-300 ease-out group-data-[cta=true]/header:ml-2 group-data-[cta=true]/header:max-w-48 group-data-[cta=true]/header:opacity-100"
          >
            <Button variant="brand" className={CTA} render={<a href="#get-started" />}>
              Get started
            </Button>
          </span>
        </div>
      </div>
    </HeaderMotion>
  )
}
