import { MapPin, Navigation, Phone } from 'lucide-react'
import { directionsHref } from '@/lib/visit-files'
import type { Branch } from '@/lib/data'

/** Directions open the address in the visitor's maps; the city keeps it unambiguous without assuming a country. */
const mapsHref = (b: Branch) => directionsHref(b.id)

/** Each branch: its area, street and first opening hours, with directions and a call button. */
export function BranchList({ branches }: { branches: Branch[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(360px,100%),1fr))] gap-3">
      {branches.map((b) => {
        const area = b.name.replace(' — ', ' · ')
        return (
          <div
            key={b.id}
            className="flex items-start gap-3.5 rounded-[20px] bg-white/72 p-[18px] shadow-[0_12px_30px_rgba(106,92,176,.07)] backdrop-blur-[18px] backdrop-saturate-[1.2]"
          >
            <span aria-hidden className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[var(--tint-lilac-bg)] text-[var(--tint-lilac-fg)]">
              <MapPin className="size-[15px]" strokeWidth={1.8} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div>
                <div className="text-[14.5px] leading-[1.35] font-semibold text-pretty text-ink-900">{area}</div>
                <div className="mt-1 flex flex-wrap gap-x-2.5 text-[13px] leading-normal text-ink-700">
                  <span>{b.address || b.city}</span>
                  <span className="text-ink-500">{b.hours.split(' · ')[0]}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={mapsHref(b)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Directions to ${area}`}
                  title="Get directions"
                  className="flex size-8 items-center justify-center rounded-full bg-indigo-900 text-white transition-colors outline-none hover:bg-indigo-950 hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  <Navigation aria-hidden className="size-[13px]" strokeWidth={2} />
                </a>
                <a
                  href={`tel:${b.phone.replace(/\s/g, '')}`}
                  aria-label={`Call ${b.phone}`}
                  className="flex h-8 items-center gap-[7px] rounded-full bg-wash-1 pr-[13px] pl-[11px] text-[12.5px] font-medium whitespace-nowrap text-ink-900 tabular-nums no-underline transition-colors outline-none hover:bg-[var(--tint-lilac-bg)] hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <Phone aria-hidden className="size-[13px]" strokeWidth={1.8} />
                  {b.phone}
                </a>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
