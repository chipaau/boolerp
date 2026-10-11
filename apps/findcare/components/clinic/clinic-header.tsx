import { Overline } from '@/components/ui/text'
import type { Clinic } from '@/lib/data'

// Each way of booking keeps the colour it has elsewhere: indigo for a time, mint for the queue,
// butter for a request, peach for paying. The words carry the meaning; the dot only backs it up.
function tags(c: Clinic) {
  const p = c.pay
  const pay = p.prepay === 'required' ? (p.deposit ? `MVR ${p.deposit} deposit` : 'Pay ahead') : p.transfer ? 'Pay ahead or at clinic' : 'Pay at clinic'
  return [
    c.types.exact && { label: 'Book an exact time', dot: 'bg-indigo-500' },
    c.types.queue && { label: 'Walk-in queue', dot: 'bg-[var(--tint-mint-fg)]' },
    c.types.request && { label: 'Request a visit', dot: 'bg-[var(--tint-butter-fg)]' },
    { label: pay, dot: 'bg-[var(--tint-peach-fg)]' },
  ].filter((t) => !!t)
}

/** The clinic's places, name, how it books and takes payment, and its arrival and change notes. */
export function ClinicHeader({ clinic, places }: { clinic: Clinic; places: string }) {
  const notes = [clinic.arrive, clinic.cancelPolicy].map((v) => v.trim().replace(/\.$/, '')).filter(Boolean)
  return (
    <div className="flex flex-col gap-4 pt-2 pb-1">
      <div>
        <Overline size="lg">{places}</Overline>
        <h1 className="mt-3.5 text-[clamp(28px,5vw,40px)] leading-[1.05] font-semibold tracking-[-0.025em] text-balance text-ink-900">{clinic.name}</h1>
      </div>
      <div className="flex flex-col gap-2">
        <ul className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5">
          {tags(clinic).map((t) => (
            <li key={t.label} className="inline-flex items-center gap-2 text-[14px] font-medium text-ink-900">
              <span aria-hidden className={`size-1.5 rounded-full ${t.dot}`} />
              {t.label}
            </li>
          ))}
        </ul>
        {notes.length > 0 && <p className="text-[13.5px] leading-[1.6] text-pretty text-ink-600">{notes.join('. ')}.</p>}
      </div>
    </div>
  )
}
