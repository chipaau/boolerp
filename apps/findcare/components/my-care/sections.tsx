import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Avatar, initialsOf } from '@/components/ui/avatar'
import { db, sessionFor } from '@/lib/data'
import type { Account, Appointment, Tint } from '@/lib/data'
import { routes } from '@/lib/routes'
import { family, openSoon, yourDoctors } from './dashboard'
import { DateTile, ListCard, ListRow, RowAvatar } from './list-card'

/** Doctors with a time today (then tomorrow), for when nothing is happening today. */
export function OpenToday() {
  const rows = openSoon()
  if (!rows.length) return null
  return (
    <ListCard title="Open today near you" link={{ label: 'Browse', href: routes.find('doctors') }}>
      {rows.map((r) => (
        <ListRow
          key={r.key}
          href={r.href}
          lead={<RowAvatar initials={r.doctor.initials || initialsOf(r.doctor.name)} tint={r.tint} />}
          title={r.doctor.name}
          sub={r.sub}
          trailing={<span className="shrink-0 text-[11.5px] font-medium text-success-fg tabular-nums">{r.time}</span>}
        />
      ))}
    </ListCard>
  )
}

/** The visits after the next one. */
export function ComingUp({ account, visits }: { account: Account; visits: Appointment[] }) {
  if (!visits.length) return null
  const s = db()
  return (
    <ListCard title="Coming up" link={{ label: 'View all', href: routes.appointments() }}>
      {visits.slice(0, 3).map((a) => {
        const doctor = s.doctors[a.doctorId]
        const spec = s.specialties.find((x) => x.id === doctor.spec)
        const who = a.patientId !== account.holderId ? `${s.patients[a.patientId].name.split(' ')[0]} · ` : ''
        const rebook = a.status === 'needs_reschedule'
        const at = a.time ?? (a.queueNo ? `#${a.queueNo}` : sessionFor(a.sessionId).start)
        return (
          <ListRow
            key={a.id}
            href={routes.appointments({ appt: a.id })}
            lead={<DateTile date={a.date} />}
            title={doctor.name}
            sub={`${who}${spec?.name ?? ''} · ${s.clinics[s.branches[a.branchId].clinicId].name}`}
            trailing={<span className={`shrink-0 text-[11.5px] font-medium tabular-nums ${rebook ? 'text-danger' : 'text-ink-900'}`}>{rebook ? 'Reschedule' : at}</span>}
          />
        )
      })}
    </ListCard>
  )
}

/** Saved and past doctors with their next opening, to book again in one tap. */
export function YourDoctors({ account }: { account: Account }) {
  const { title, doctors } = yourDoctors(account)
  if (!doctors.length) return null
  return (
    <ListCard title={title}>
      {doctors.map((d) => (
        <ListRow
          key={d.doctor.id}
          lead={<RowAvatar initials={d.doctor.initials || initialsOf(d.doctor.name)} tint={d.tint} />}
          title={d.doctor.name}
          sub={d.sub}
          trailing={
            <Link
              href={d.href}
              aria-label={`${d.slot === 'Waitlist' ? 'Join the waitlist for' : 'Book'} ${d.doctor.name}, ${d.slot}`}
              className="flex h-7 shrink-0 items-center rounded-full px-[11px] text-[11.5px] font-medium whitespace-nowrap text-ink-900 tabular-nums no-underline shadow-outline transition-colors hover:bg-indigo-900 hover:text-white hover:shadow-none"
            >
              {d.slot}
            </Link>
          }
        />
      ))}
    </ListCard>
  )
}

// The family rows take their own tints in turn, so people are told apart at a glance.
const FAMILY_TINTS: (Tint | 'indigo')[] = ['indigo', 'mint', 'butter', 'lilac']

export function Family({ account }: { account: Account }) {
  return (
    <ListCard title="Family">
      {family(account).map((p, i) => {
        const tint = FAMILY_TINTS[i % FAMILY_TINTS.length]
        return (
          <ListRow
            key={p.id}
            href={routes.account()}
            lead={
              tint === 'indigo' ? (
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-900 text-[12px] font-semibold text-white">
                  {initialsOf(p.fullName)}
                </span>
              ) : (
                <Avatar initials={initialsOf(p.fullName)} tint={tint} size={36} />
              )
            }
            title={
              <>
                {p.name} {p.relation && <span className="font-normal text-ink-500">· {p.relation}</span>}
              </>
            }
            sub={p.line}
          />
        )
      })}
      <Link
        href={`${routes.account()}#add`}
        className="flex items-center gap-2.5 rounded-[14px] px-2.5 py-[9px] text-[12.5px] font-medium text-ink-700 no-underline hover-glass hover:text-ink-900"
      >
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(30,10,24,.18)]">
          <Plus className="size-3.5" strokeWidth={2} />
        </span>
        Add a family member
      </Link>
    </ListCard>
  )
}
