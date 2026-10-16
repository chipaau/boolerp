import { Globe2, Layers, Server } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HEX_MASK } from '@/components/hex'
import { Rise } from '@/components/rise'

/** What Bool holds to: the product's own principles (docs/product/scope.md), in a line each. */
const BELIEFS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Layers, title: 'One record, every app', body: 'Your people, places and rules are set out once, and every app works from them. Nothing is copied, so nothing disagrees.' },
  { icon: Globe2, title: 'Local, by design', body: 'Atolls, eFaas and the Rufiyaa today. Each country’s rules are kept as data, so the next country is added, not rewritten.' },
  { icon: Server, title: 'Yours to run', body: 'We run it for you, or you run the same release on your own servers. The product is the same either way.' },
]

/** About us: who makes Bool, and what it holds to. */
export function About() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="office-grid grid-fade-top pointer-events-none absolute inset-0" />
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-28 lg:pt-36 2xl:max-w-[88rem]">
          <p className="text-overline tracking-[0.28em] text-muted-foreground">About us</p>
          <h1 className="mt-4 max-w-3xl text-[clamp(2.5rem,3.9vw,3.6rem)] font-light leading-[1.05] tracking-[-0.035em] text-foreground">
            Made in the Maldives,
            <br />
            <span className="text-(--brand)">for how organisations work.</span>
          </h1>
          <p className="section-lead mt-6 max-w-xl text-muted-foreground">
            Bool is one workspace for the apps an organisation runs on, made in Malé. It starts with how organisations here actually work, and it is built to carry to every country it goes to next.
          </p>
        </div>
      </section>

      <section>
        <Rise className="mx-auto w-full max-w-7xl px-6 pb-24 2xl:max-w-[88rem]">
          <h2 data-rise="" className="section-title text-foreground">
            What we <span className="text-(--brand)">hold to.</span>
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {BELIEFS.map(({ icon: Icon, title, body }) => (
              <article key={title} data-rise="" className="glass-card p-7">
                <span className="relative grid size-12 place-items-center">
                  <span aria-hidden="true" className="absolute inset-0 bg-(--brand-soft)/15" style={{ mask: HEX_MASK }} />
                  <Icon className="relative size-5 text-(--brand)" strokeWidth={1.6} />
                </span>
                <h3 className="card-title mt-5 text-foreground">{title}</h3>
                <p className="card-body mt-2 text-foreground/75">{body}</p>
              </article>
            ))}
          </div>
        </Rise>
      </section>
    </>
  )
}
