import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { About } from '@/features/about/about'

export const metadata: Metadata = {
  title: 'About us — Bool ERP',
  description: 'Bool is one workspace for the apps an organisation runs on, made in Malé, Maldives.',
}

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <About />
      </main>
      <SiteFooter />
    </>
  )
}
