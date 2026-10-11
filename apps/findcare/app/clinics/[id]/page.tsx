'use client'

import { useParams } from 'next/navigation'
import { ClinicProfile } from '@/components/clinic/clinic-profile'
import { Page } from '@/components/shell/page'

export default function ClinicPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <Page>
      <ClinicProfile id={id} />
    </Page>
  )
}
