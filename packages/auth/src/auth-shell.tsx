import type { ReactNode } from 'react'
import logo from '@workspace/assets/logos/bool-logo.png'
import { Hexagon } from '@workspace/ui/components/hexagon'
import { MadeBy } from '@workspace/ui/components/made-by'

/**
 * The sign-in canvas from the Bool Login design: Warm Ivory page with three faded hexagons
 * behind a 408px column that rises in. Shared by every Kratos self-service screen (login,
 * recovery, verification, settings) in app and admin; the screens supply title, intro and form.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  brand = 'Bool',
  links = [],
}: {
  title: string
  subtitle?: string
  children: ReactNode
  /** Row under the form (e.g. "Forgot password?"). */
  footer?: ReactNode
  brand?: string
  /** Legal / status links beside the copyright line, when the deployment has them. */
  links?: { label: string; href: string }[]
}) {
  const year = new Date().getFullYear()
  return (
    <div className="relative flex min-h-svh flex-col items-center overflow-hidden bg-background">
      {/* decorative honeycomb, faded so it never competes with the form */}
      <Hexagon
        aria-hidden="true"
        size="860px"
        className="pointer-events-none absolute -top-[260px] left-1/2 -translate-x-1/2 text-card opacity-60"
      />
      <Hexagon
        aria-hidden="true"
        size="590px"
        className="pointer-events-none absolute -bottom-[240px] -left-[220px] text-card opacity-70"
      />
      <Hexagon
        aria-hidden="true"
        size="490px"
        className="pointer-events-none absolute -right-[190px] -bottom-[160px] text-primary opacity-30"
      />

      <div className="relative flex w-full max-w-[408px] flex-1 flex-col justify-center px-6 pt-14 pb-8">
        <div className="animate-rise">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" aria-hidden="true" width={34} height={39} className="h-[39px] w-[34px] object-contain" />
            <span className="text-2xl tracking-[-0.015em] text-foreground">{brand}</span>
          </div>

          <h1 className="mt-[38px] text-display-sm font-normal text-foreground">{title}</h1>
          {subtitle && <p className="mt-2.5 text-ui-lg leading-[1.55] text-pretty text-muted-foreground">{subtitle}</p>}

          <div className="mt-[30px]">{children}</div>
          {footer && <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 text-ui-sm">{footer}</div>}
        </div>
      </div>

      <div className="relative flex w-full max-w-[408px] flex-wrap items-center gap-[18px] px-6 pb-[34px] text-meta text-muted-foreground">
        <span>
          © {year} {brand}
        </span>
        <MadeBy />
        {links.map((l) => (
          <a key={l.href} href={l.href} className="text-link hover:underline hover:underline-offset-[3px]">
            {l.label}
          </a>
        ))}
      </div>
    </div>
  )
}
