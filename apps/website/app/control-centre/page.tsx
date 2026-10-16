import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { ControlCentre } from '@/features/control-centre/control-centre'

export const metadata: Metadata = {
  title: 'Control Centre — Bool ERP',
  description: 'The record every Bool app reads: your organisation’s people, places, approvals and rules, set up once.',
}

export default function ControlCentrePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <ControlCentre />
      </main>
      <SiteFooter />
    </>
  )
}
