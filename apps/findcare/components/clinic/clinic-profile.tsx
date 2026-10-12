'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { bySoonest } from '@/components/find/openings'
import { ButtonLink } from '@/components/ui/button'
import { db, find, search, useNow } from '@/lib/data'
import { routes } from '@/lib/routes'
import { BranchList } from './branch-list'
import { ClinicBookables } from './clinic-bookables'
import { ClinicHeader } from './clinic-header'

/** A clinic: who it is and how it books, its branches, and everyone you can book there. */
export function ClinicProfile({ id }: { id: string }) {
  const ready = useNow()
  const clinic = ready ? find.clinic(id) : undefined
  // the page is a client component, so its title is set here rather than through metadata
  useEffect(() => {
    if (clinic) document.title = `${clinic.name} · FindCare`
  }, [clinic])
  if (!ready) return null
  if (!clinic) return <ClinicNotFound />

  const branches = Object.values(db().branches).filter((b) => b.clinicId === clinic.id)
  const places = [...new Set(branches.map((b) => b.city).filter(Boolean))].join(' & ')
  const rows = search({})
    .filter((r) => r.clinic.id === clinic.id)
    .sort(bySoonest)

  return (
    <>
      <BackLink />
      <div className="flex flex-col gap-[22px]">
        <ClinicHeader clinic={clinic} places={places} />
        <BranchList branches={branches} />
      </div>
      <ClinicBookables clinicName={clinic.name} rows={rows} />
    </>
  )
}

function BackLink() {
  return (
    <Link href={routes.find()} className="self-start text-[12.5px] font-medium text-ink-600 no-underline hover:text-ink-900">
      ← Find care
    </Link>
  )
}

/** An old or mistyped link: say so plainly and lead back to the clinics. */
function ClinicNotFound() {
  return (
    <>
      <BackLink />
      <div className="glass flex flex-col items-start gap-4 rounded-[22px] p-7">
        <h1 className="text-[22px] leading-tight font-semibold text-ink-900">We couldn’t find that clinic</h1>
        <p className="text-[14px] leading-normal text-ink-600">The link may be old, or the clinic may no longer take bookings through FindCare.</p>
        <ButtonLink href={`${routes.find()}#clinics`} variant="outline">
          See clinics
        </ButtonLink>
      </div>
    </>
  )
}
