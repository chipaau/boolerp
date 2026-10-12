import Link from 'next/link'
import { routes } from '@/lib/routes'
import type { ClinicSummary } from './openings'

/** A clinic in a listing: its places and size, and its soonest opening. */
export function ClinicCard({ clinic }: { clinic: ClinicSummary }) {
  return (
    <Link
      href={routes.clinic(clinic.id)}
      className="glass flex flex-col gap-3.5 rounded-[20px] p-[18px] text-ink-900 no-underline transition-colors hover-glass hover:text-ink-900"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{clinic.name}</div>
        <div className="mt-1 text-[12px] text-ink-600">
          {clinic.places} · {clinic.doctors} {clinic.doctors === 1 ? 'doctor' : 'doctors'}
        </div>
      </div>
      <div className="flex items-baseline justify-between pt-3 shadow-[inset_0_1px_0_var(--line-2)]">
        <div className="text-[13px] font-semibold">{clinic.next}</div>
        <div className="text-[9.5px] font-medium tracking-[0.18em] text-ink-500 uppercase">Next opening</div>
      </div>
    </Link>
  )
}

export function ClinicGrid({ clinics }: { clinics: ClinicSummary[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-[18px]">
      {clinics.map((c) => (
        <ClinicCard key={c.id} clinic={c} />
      ))}
    </div>
  )
}
