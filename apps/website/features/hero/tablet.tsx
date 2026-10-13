import Image from 'next/image'
import { DASHBOARD, TABLET } from './scene'

/**
 * A frosted-glass tablet floating in the light, laid back in space and showing the real Bool
 * dashboard, drawn in CSS (styles in app/globals.css) so the product stays sharp at any size.
 *
 * The opening brings it into focus by crossfading two copies rather than animating a blur: the
 * `soft` copy is blurred once and only exists while the opening is pending, and the `sharp` copy
 * fades in over it as the bee lands. Opacity is all that animates, so the browser never re-blurs.
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
        </div>
      </div>
    </div>
  )
}
