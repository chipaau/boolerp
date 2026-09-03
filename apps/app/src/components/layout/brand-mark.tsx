import { Link } from '@tanstack/react-router'
import logo from '@workspace/assets/logos/hexa-logo.png'
import { BRAND } from '@/lib/brand'

// The bee-in-hexagon logo + product name; links home.
export function BrandMark() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <img src={logo} alt="" aria-hidden="true" width={34} height={39} className="h-[39px] w-[34px] object-contain" />
      <span className="text-title text-foreground">{BRAND.name}</span>
    </Link>
  )
}
