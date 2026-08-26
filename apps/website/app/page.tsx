import { Button } from '@workspace/ui/components/button'
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
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <a href="/" className="font-semibold tracking-tight">
            Bool<span className="text-muted-foreground"> ERP</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <a href="#modules" className="hover:text-foreground">Modules</a>
            <a href="#deployment" className="hover:text-foreground">Deployment</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
          </nav>
          <Button asChild size="sm">
            <a href="#contact">Get started</a>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 py-24 text-center">
          <p className="mb-4 text-sm font-medium text-muted-foreground">
            Multi-tenant ERP · Maldives
          </p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Run your institution on one system.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Bool ERP unifies inventory, HR, procurement, and performance for councils, ministries,
            health facilities, and companies — as cloud SaaS, or self-hosted on your own infrastructure.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="#contact">Get started</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#contact">Talk to us</a>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Built for councils, ministries, and health facilities — bilingual Dhivehi &amp; English.
          </p>
        </section>

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
              <Button asChild size="lg">
                <a href="mailto:sales@bool.mv?subject=Bool%20ERP%20enquiry">Contact sales</a>
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
