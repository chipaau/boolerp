import { HexGlyph } from '@workspace/ui/components/hex-glyph'
import { cn } from '@workspace/ui/lib/utils'
import analyticsArt from '@workspace/assets/logos/analytics.png'
import assetArt from '@workspace/assets/logos/asset.png'
import assetGlyph from '@workspace/assets/logos/asset-glyph.png'
import controlGlyph from '@workspace/assets/logos/control-centre-glyph.png'
import directoryArt from '@workspace/assets/logos/directory.png'
import inventoryArt from '@workspace/assets/logos/inventory.png'
import notesGlyph from '@workspace/assets/logos/notes-glyph.png'
import procurementArt from '@workspace/assets/logos/procurement.png'
import taskArt from '@workspace/assets/logos/task.png'
import taskGlyph from '@workspace/assets/logos/task-glyph.png'

// Artwork per app slug: `art` is the large illustration for the Home tile, `glyph` the small
// single-colour mark for chrome (sidebar, inbox rows, switcher). Either may be missing; the
// component falls back glyph -> art -> hex glyph in the app hue. Adding artwork is one line here.
const ARTWORK: Partial<Record<string, { art?: string; glyph?: string }>> = {
  'control-centre': { glyph: controlGlyph },
  tasks: { art: taskArt, glyph: taskGlyph },
  inventory: { art: inventoryArt },
  asset: { art: assetArt, glyph: assetGlyph },
  notes: { glyph: notesGlyph },
  directory: { art: directoryArt },
  analytics: { art: analyticsArt },
  procurement: { art: procurementArt },
  calendar: { art: procurementArt }, // the design reuses this illustration for Calendar
}

// Single accent per app for the fallback glyph (icons never carry more than one colour).
const HUE: Partial<Record<string, string>> = {
  inventory: 'text-brand',
  tasks: 'text-sage',
  asset: 'text-tone-slate',
  analytics: 'text-tone-plum',
  'control-centre': 'text-brand',
  notes: 'text-sage',
  directory: 'text-brand',
  hrms: 'text-tone-plum',
  procurement: 'text-tone-slate',
  calendar: 'text-brand',
}

export function AppIcon({
  slug,
  variant = 'glyph',
  size = 36,
  className,
}: {
  slug: string
  /** `art` for the large tile illustration, `glyph` for the small mark. */
  variant?: 'art' | 'glyph'
  /** Rendered box size in px (the image keeps its own aspect inside it). */
  size?: number
  className?: string
}) {
  const a = ARTWORK[slug]
  const src = variant === 'art' ? (a?.art ?? a?.glyph) : (a?.glyph ?? a?.art)
  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        style={{ width: size, height: size }}
        // the artwork is painted for cream; on the dark page it is dimmed a step so it sits with the text
        className={cn('shrink-0 object-contain dark:brightness-[.82] dark:saturate-[.9]', className)}
      />
    )
  }
  return <HexGlyph size={size * 0.8} className={cn(HUE[slug] ?? 'text-sage', className)} />
}
