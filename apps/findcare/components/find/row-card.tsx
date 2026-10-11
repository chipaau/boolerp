'use client'

import { ListingCard } from '@/components/ui/listing-card'
import { fmtDay, payMode } from '@/lib/data'
import type { SearchRow } from '@/lib/data'
import { isService, openingTimes, rowHref } from './openings'
import type { RowFrom } from './openings'

/** A search row as a card: up to eight times on its next open day, three shown, the rest behind "+N". */
export function RowCard({ row, from }: { row: SearchRow; from?: RowFrom }) {
  const { doctor, spec, clinic, branch, next } = row
  return (
    <ListingCard
      name={doctor.name}
      sub={`${isService(row) ? (doctor.duration ?? spec.name) : spec.name} · ${clinic.name}`}
      initials={doctor.initials}
      tint={spec.tint}
      href={rowHref(row, from)}
      fee={row.fee ? `MVR ${row.fee}` : undefined}
      payTag={payMode(clinic.id)}
      day={next ? fmtDay(next.date) : 'No openings'}
      times={openingTimes(doctor.id, branch.id, next?.date, 8)}
      expandable
    />
  )
}

/** Cards in the listing grid: as many 330px columns as fit. */
export function RowGrid({ rows, from }: { rows: SearchRow[]; from?: RowFrom }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(330px,100%),1fr))] gap-[18px]">
      {rows.map((r) => (
        <RowCard key={r.key} row={r} from={from} />
      ))}
    </div>
  )
}
