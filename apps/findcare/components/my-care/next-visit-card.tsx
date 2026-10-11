import { Clock } from 'lucide-react'
import { directionsHref } from '@/lib/visit-files'
import { Avatar, initialsOf } from '@/components/ui/avatar'
import { ButtonLink, buttonClass } from '@/components/ui/button'
import { FactTile, Overline } from '@/components/ui/text'
import { db, fmtDate, fmtDay, sessionFor } from '@/lib/data'
import type { Account, Appointment } from '@/lib/data'
import { routes } from '@/lib/routes'
import { relativeDay, visitNote } from './dashboard'

/** The next visit, with directions and a way to change it; or, with nothing booked, a way to start. */
export function NextVisitCard({ account, visit, hasHistory }: { account: Account; visit: Appointment | undefined; hasHistory: boolean }) {
  if (!visit) {
    return (
      <section aria-label="Next appointment" className="glass rounded-[20px] p-[18px]">
        <Overline>Next appointment</Overline>
        <p className="mt-3.5 text-[18px] leading-[1.25] font-semibold text-balance">{hasHistory ? 'Nothing booked right now.' : 'Welcome to FindCare.'}</p>
        <p className="mt-2 text-[13px] leading-normal text-ink-600 text-pretty">
          {hasHistory
            ? 'Book again with a doctor you’ve seen, or search for someone new.'
            : 'Search by specialty or clinic and book your first visit. Your appointments, queue updates and offers will show up here.'}
        </p>
        <ButtonLink href={routes.find('doctors')} className="mt-4 w-full">
          Find a doctor
        </ButtonLink>
      </section>
    )
  }
  const s = db()
  const doctor = s.doctors[visit.doctorId]
  const spec = s.specialties.find((x) => x.id === doctor.spec)
  const branch = s.branches[visit.branchId]
  const day = fmtDay(visit.date)
  const forWhom = visit.patientId !== account.holderId ? ` · ${s.patients[visit.patientId].name.split(' ')[0]}` : ''
  const at = visit.time ?? (visit.queueNo ? `Queue #${visit.queueNo}` : sessionFor(visit.sessionId).start)
  return (
    <section aria-label="Next appointment" className="glass rounded-[20px] p-[18px]">
      <div className="flex items-center justify-between">
        <Overline>Next appointment</Overline>
        <Overline className="text-indigo-500">{relativeDay(visit.date)}</Overline>
      </div>
      <div className="mt-3.5 flex items-center gap-3">
        <Avatar initials={doctor.initials || initialsOf(doctor.name)} tint={spec?.tint ?? 'blue'} size={44} />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">{doctor.name}</div>
          <div className="mt-[3px] text-[12px] text-ink-600">{[spec?.name, s.clinics[branch.clinicId].name].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <FactTile size="lg" label="Date" value={day === 'Today' || day === 'Tomorrow' ? day : fmtDate(visit.date)} />
        <FactTile size="lg" label={`${branch.city}${forWhom}`} value={at} />
      </div>
      <p className="mt-3.5 flex items-center gap-2 text-[12px] leading-[1.45] text-ink-600">
        <Clock aria-hidden className="size-3.5 shrink-0 text-indigo-500" strokeWidth={1.8} />
        {visitNote(visit)}
      </p>
      <div className="mt-4 flex gap-2">
        <a href={directionsHref(visit.branchId)} target="_blank" rel="noopener noreferrer" className={buttonClass({ size: 'md' }, 'flex-1 text-[10.5px]')}>
          Directions
        </a>
        <ButtonLink href={routes.appointments({ appt: visit.id })} variant="outline" className="flex-1 text-[10.5px]">
          Reschedule
        </ButtonLink>
      </div>
    </section>
  )
}
