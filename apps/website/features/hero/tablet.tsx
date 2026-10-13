import Image from 'next/image'
import { Check } from 'lucide-react'
import { LANDING_TOAST } from './mock'
import { DASHBOARD, TABLET } from './scene'

/**
 * A frosted-glass tablet floating in the light, laid back in space and showing the real Bool
 * dashboard, drawn in CSS (styles in app/globals.css) so the product stays sharp at any size.
 *
 * The opening brings it into focus by crossfading two copies rather than animating a blur: the
 * `soft` copy is blurred once and only exists while the opening is pending, and the `sharp` copy
 * fades in over it as the bee lands. Opacity is all that animates, so the browser never re-blurs.
 * The sharp copy also carries the notification that slides in at touchdown: the bee's landing is
 * the moment the work gets done.
 */
export function Tablet({ focus }: { focus: 'soft' | 'sharp' }) {
  return (
    <div data-tablet={focus} aria-hidden={focus === 'soft' || undefined} className="tablet-layer absolute inset-0">
      <div aria-hidden="true" className="tablet-shadow" />
      <div className="tablet" style={{ left: TABLET.left, top: TABLET.top, width: TABLET.width, transform: TABLET.transform }}>
        <div className="tablet-screen">
          <Image
            src={DASHBOARD.src}
            alt={focus === 'sharp' ? 'The Bool workspace home' : ''}
            width={DASHBOARD.width}
            height={DASHBOARD.height}
            priority={focus === 'sharp'}
            sizes="55vw"
            className="size-full object-cover object-top"
          />
          {focus === 'sharp' && <Toast />}
        </div>
      </div>
    </div>
  )
}

/** A product notification, sized in stage units (cqw) so it scales and tilts with the tablet. */
function Toast() {
  return (
    <div
      data-tablet-toast=""
      role="status"
      className="absolute bottom-[5%] right-[3.5%] flex items-center gap-[0.9cqw] rounded-[0.9cqw] bg-card py-[0.8cqw] pl-[0.8cqw] pr-[1.6cqw] shadow-floating"
    >
      <span className="grid size-[2.2cqw] place-items-center rounded-full bg-sage-soft text-sage-soft-foreground">
        <Check className="size-[1.25cqw]" strokeWidth={2.5} />
      </span>
      <span className="leading-tight">
        <span className="block text-[1.25cqw] font-bold text-foreground">{LANDING_TOAST.title}</span>
        <span className="block text-[1cqw] text-muted-foreground">{LANDING_TOAST.meta}</span>
      </span>
    </div>
  )
}
