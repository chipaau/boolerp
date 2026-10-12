import Image from 'next/image'
import type { CSSProperties } from 'react'
import { DASHBOARD } from './scene'

/**
 * A neutral silver tablet on a slim stand, showing the real Bool dashboard, drawn in CSS 3D (styles
 * in app/globals.css) so the product stays sharp at any size. Rendered finished; the opening
 * (hero-motion.tsx) starts its screen dark and out of focus and wakes it as the bee lands.
 */
export function Tablet({ style }: { style?: CSSProperties }) {
  return (
    <div data-tablet="" className="tablet" style={style}>
      <div aria-hidden="true" className="tablet-shadow" />
      <div className="tablet-world">
        <div aria-hidden="true" className="tablet-stand" />
        <div className="tablet-body">
          <div aria-hidden="true" className="tablet-back" />
          <div className="tablet-screen">
            <div data-tablet-display="" className="tablet-display">
              <Image
                src={DASHBOARD.src}
                alt="The Bool workspace home"
                width={DASHBOARD.width}
                height={DASHBOARD.height}
                priority
                sizes="45vw"
                className="size-full object-cover object-top"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
