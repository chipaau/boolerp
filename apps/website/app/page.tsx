import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Deploy } from '@/features/deploy/deploy'
import { Hero } from '@/features/hero/hero'
import { Local } from '@/features/local/local'
import { Office } from '@/features/office/office'
import { Tickets } from '@/features/tickets/tickets'

export default function Home() {
  return (
    <>
      {/* over the hero, fixed: it steps aside while the visitor scrolls down */}
      <SiteHeader />

      <main>
        <Hero />

        <Office />

        <Local />

        <Deploy />

        <Tickets />
      </main>

      <SiteFooter />
    </>
  )
}
