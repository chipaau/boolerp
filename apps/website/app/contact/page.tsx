import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Contact } from '@/features/contact/contact'

export const metadata: Metadata = {
  title: 'Let’s talk — Bool ERP',
  description: 'Tell us about your organisation and we’ll show you Bool set up for it.',
}

export default function ContactPage() {
  return (
    // the page fills the window at least, so the footer sits at its foot
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="grow">
        <Contact />
      </main>
      <SiteFooter call={false} />
    </div>
  )
}
