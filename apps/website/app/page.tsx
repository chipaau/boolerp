import { Button } from '@workspace/ui/components/button'
import { SiteHeader } from '@/components/site-header'
import { Hero } from '@/features/hero/hero'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

const modules = [
  { name: 'Inventory', dv: 'ސްޓޮކް', desc: 'Stock, stores, and asset tracking across sites and sub-tenants.' },
  { name: 'HRMS', dv: 'އެޗްއާރު', desc: 'People, positions, attendance, and payroll-ready records.' },
  { name: 'Procurement', dv: 'ޕްރޮކިއުމަންޓް', desc: 'Requests, quotations, and purchase orders with gapless numbering.' },
  { name: 'Performance', dv: 'ޕާފޯމަންސް', desc: 'Targets, indicators, and reporting for oversight bodies.' },
  {
    name: 'Control Centre',
    dv: 'ކޮންޓްރޯލް ސެންޓަރ',
    desc: 'The tenant’s own admin: users, roles, org units, sites, and settings.',
  },
]

export default function Home() {
  return (
    <>
      {/* over the hero, fixed: it steps aside while the visitor scrolls down */}
      <SiteHeader />

      <main>
        <Hero />

        {/* Modules */}
        <section id="modules" className="border-t border-border/60 bg-muted/20">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">One platform, every department</h2>
              <p className="mt-3 text-muted-foreground">
                Modules that share one source of truth, with parent-tenant aggregation for oversight.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((m) => (
                <Card key={m.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{m.name}</span>
                      <span className="text-sm font-normal text-muted-foreground">{m.dv}</span>
                    </CardTitle>
                    <CardDescription>{m.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Deployment */}
        <section id="deployment" className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Deploy your way</h2>
              <p className="mt-3 text-muted-foreground">
                The same product, whether we run it for you or you run it yourself.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Cloud SaaS</CardTitle>
                  <CardDescription>
                    Provisioned and operated by us, with regional clusters for data residency.
                    Your institution and its subordinate facilities, live on day one.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Best for single institutions and groups that want zero infrastructure to manage.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Self-hosted</CardTitle>
                  <CardDescription>
                    One artifact, one migration command. Run Bool ERP on your own box for your
                    institution and its sub-tenants — no external dependencies.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Best for ministries and organisations with on-premises or data-sovereignty needs.
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Built for the Maldives */}
        <section className="border-t border-border/60 bg-muted/20">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Built for the Maldives</h2>
            </div>
            <div className="mx-auto mt-10 grid max-w-4xl gap-x-10 gap-y-6 text-sm sm:grid-cols-2">
              {[
                ['Bilingual by design', 'Every operational record carries paired Dhivehi (Thaana) and English text.'],
                ['Local geography', 'Atoll → island → ward hierarchy, with a global fallback for foreign entities.'],
                ['eFaas-ready', 'National identity verification via eFaas, kept separate from core identity.'],
                ['MVR & USD', 'Multi-currency money with captured exchange rates; MVR by default.'],
                ['Oversight built in', 'Parent tenants aggregate authorised subordinate and affiliated facilities.'],
                ['Audit & lifecycle', 'Institutional-grade audit, per-tenant data lifecycle, prompt access revocation.'],
              ].map(([title, desc]) => (
                <div key={title}>
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact / CTA */}
        <section id="contact" className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-6 py-24 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Ready to get started?</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              SaaS onboarding and on-premises setup are handled with you directly. Reach out and
              we’ll get your institution provisioned.
            </p>
            <div className="mt-8">
              <Button size="lg" render={<a href="mailto:sales@bool.mv?subject=Bool%20ERP%20enquiry" />}>
                Contact sales
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">sales@bool.mv</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Bool ERP</span>
          <span>Malé, Maldives</span>
        </div>
      </footer>
    </>
  )
}
