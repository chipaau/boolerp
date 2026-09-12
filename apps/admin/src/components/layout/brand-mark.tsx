import { Link } from '@tanstack/react-router'
import logo from '@workspace/assets/logos/hexa-logo.png'
import { BRAND } from '@/lib/brand'

// The bee-in-hexagon logo (38px) + product name; links home. Same mark as apps/app's BrandMark.
export function BrandMark() {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
    >
      <img src={logo} alt="" aria-hidden="true" width={38} height={38} className="block size-[38px] object-contain" />
      <span className="text-heading-sm font-bold tracking-[-0.01em] text-foreground">{BRAND.name}</span>
    </Link>
  )
}
