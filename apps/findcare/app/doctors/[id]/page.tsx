'use client'

import { useSearchParams } from 'next/navigation'
import { use } from 'react'
import { DoctorScreen } from '@/components/doctor/doctor-screen'

/**
 * A doctor's or service's page: profile, locations, open times and booking. `?b=` picks the branch,
 * `?date=` the day, and `?resched=<apptId>` moves an existing visit instead of booking a new one.
 * A client page because the data lives in the browser.
 */
export default function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const q = useSearchParams()
  // Remount on a new doctor, so no pick or hold carries over from the previous one.
  return <DoctorScreen key={id} id={id} query={q} />
}
