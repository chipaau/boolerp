import { Cloud, Server } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@workspace/ui/components/card'
import { Rise } from '@/components/rise'

const OPTIONS: { icon: LucideIcon; title: string; body: string; fit: string }[] = [
  {
    icon: Cloud,
    title: 'Cloud SaaS',
    body: 'Provisioned and operated by us, with regional clusters for data residency. Your institution and its subordinate facilities, live on day one.',
    fit: 'Best for single institutions and groups that want zero infrastructure to manage.',
  },
  {
    icon: Server,
    title: 'Self-hosted',
    body: 'One artifact, one migration command. Run Bool ERP on your own box for your institution and its sub-tenants — no external dependencies.',
    fit: 'Best for ministries and organisations with on-premises or data-sovereignty needs.',
  },
]

/**
 * "Deploy your way": the same product, run by us or by you. The Maldives section's last point links
 * here (#deployment). On desktop it is a sheet of paper lying on the solutions section's orange,
 * which the scroll lifts away (features/tickets).
 */
export function Deploy() {
  return (
    <section id="deployment" className="deploy-sheet relative z-10 border-t border-border/60 bg-background lg:motion-safe:flex lg:motion-safe:min-h-svh lg:motion-safe:items-center">
      <Rise className="mx-auto w-full max-w-7xl px-6 py-24 2xl:max-w-[88rem]">
        <div data-rise="" className="max-w-2xl">
          <p className="text-overline tracking-[0.28em] text-muted-foreground">Deploy your way</p>
          <h2 className="section-title mt-4 text-foreground">
            The same product, <span className="text-(--brand)">run by us or by you.</span>
          </h2>
          <p className="section-lead mt-4 max-w-xl text-muted-foreground">Whether we run it for you or you run it yourself, it is the same Bool, with the same apps and the same record.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {OPTIONS.map(({ icon: Icon, title, body, fit }) => (
            <Card key={title} data-rise="">
              <CardHeader>
                <h3 className="card-title flex items-center gap-3 text-foreground">
                  <Icon className="size-6 shrink-0 text-(--brand)" strokeWidth={1.6} />
                  {title}
                </h3>
                <p className="card-body mt-2 text-muted-foreground">{body}</p>
              </CardHeader>
              <CardContent className="card-body text-foreground/80">{fit}</CardContent>
            </Card>
          ))}
        </div>
      </Rise>
    </section>
  )
}
