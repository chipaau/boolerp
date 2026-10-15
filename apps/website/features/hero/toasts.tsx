import Image, { type StaticImageData } from 'next/image'
import asset from '@workspace/assets/logos/asset.png'
import inventory from '@workspace/assets/logos/inventory.png'
import procurement from '@workspace/assets/logos/procurement.png'
import task from '@workspace/assets/logos/task.png'
import { HEX_MASK } from '@/components/hex'

/**
 * What Bool tells people as their day goes: one at a time, a notification from one of its apps
 * slides out over the tablet's lower right corner, stays a moment and goes, while that app's
 * hexagon on the dashboard lifts with it (hero-motion.tsx cycles them once the opening is done).
 * The cards are white glass, like the tablet's frame. Marketing fixtures, in line with the
 * dashboard and the recording.
 */
const TOASTS: { app: string; icon: StaticImageData; tile: number; title: string; line: string }[] = [
  // `tile`: the app's hexagon on the dashboard (APP_TILES in scene.ts, in order)
  { app: 'Inventory', icon: inventory, tile: 2, title: 'Stock received', line: '24 items added to Main store' },
  { app: 'Procurement', icon: procurement, tile: 7, title: 'Approval needed', line: 'Purchase request from Finance' },
  { app: 'Asset', icon: asset, tile: 3, title: 'Asset assigned', line: 'MacBook Pro 14" to Rania Bakr' },
  { app: 'Task', icon: task, tile: 1, title: 'Due today', line: 'Quarterly asset check' },
]


/** The notifications, stacked in one place over the tablet's corner, all hidden until their turn. Desktop only. */
export function HeroToasts() {
  return (
    <div data-hero-toasts="" aria-hidden="true" className="pointer-events-none absolute left-[76.5%] top-[82.5%] z-30 hidden w-[21.5%] lg:grid">
      {TOASTS.map(({ app, icon, tile, title, line }) => (
        <div key={title} data-hero-toast="" data-tile={tile} className="hero-toast invisible flex items-center gap-[0.95cqw] px-[1.05cqw] py-[0.8cqw] opacity-0 [grid-area:1/1]">
          {/* the app's own icon on a small hexagon, as on the dashboard */}
          <span className="grid size-[max(34px,2.7cqw)] shrink-0 place-items-center bg-[#f7f1e8]" style={{ mask: HEX_MASK }}>
            <Image src={icon} alt="" className="h-[52%] w-auto" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[max(10px,0.74cqw)] text-muted-foreground">
              {app} <span aria-hidden="true">·</span> now
            </span>
            <span className="mt-[0.1cqw] block truncate text-[max(12.5px,0.98cqw)] font-semibold text-foreground">{title}</span>
            <span className="block truncate text-[max(11px,0.84cqw)] text-muted-foreground">{line}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
