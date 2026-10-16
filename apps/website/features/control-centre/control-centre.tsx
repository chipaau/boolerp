import { Activity, Building2, MapPin, ScrollText, SlidersHorizontal, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Image from 'next/image'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import directoryLogo from '@workspace/assets/logos/directory.png'
import inventoryLogo from '@workspace/assets/logos/inventory.png'
import { CTA, CTA_ARROW } from '@/components/cta'
import { HEX_MASK } from '@/components/hex'
import { Rise } from '@/components/rise'
import { Fragments } from './fragments'

/** What it holds, in four groups (packages/app-control-centre's menu), each part in a line. */
const GROUPS: { icon: LucideIcon; title: string; lead: string; parts: [string, string][] }[] = [
  {
    icon: Building2,
    title: 'Organisation',
    lead: 'Who you are and who works where.',
    parts: [
      ['Admin units', 'divisions, departments and teams as one tree'],
      ['Employees', 'every person, their unit and what they can reach'],
    ],
  },
  {
    icon: MapPin,
    title: 'Places',
    lead: 'Where the work happens.',
    parts: [
      ['Sites', 'stores, offices and counters, with their bins'],
      ['Site types', 'rules set once, inherited by every site'],
      ['Regions', 'islands and cities, as data per country'],
    ],
  },
  {
    icon: ScrollText,
    title: 'Rules',
    lead: 'How things get done.',
    parts: [
      ['Approval chains', 'who signs off, in order, above what value'],
      ['Codes & numbering', 'the shape of every reference issued'],
      ['Holidays & notifications', 'kept current, sent to roles not names'],
    ],
  },
  {
    icon: Activity,
    title: 'Oversight',
    lead: 'What happened, and what needs a look.',
    parts: [
      ['Overview', 'what needs attention across every app'],
      ['Activity log', 'every change, who made it, never edited'],
    ],
  },
]

/** One person leaving, from Control Centre out to the apps: what the one record saves. */
const LEAVING: [string, string][] = [
  ['Mark them as exited', 'Once, in Control Centre. Their record and history stay.'],
  ['Access ends everywhere', 'Inventory and Scan refuse them at once; nothing to chase app by app.'],
  ['Loose ends surface', 'Anything they still hold shows on the Overview until it is dealt with.'],
  ['It is on the record', 'Who made the change, and when, in the activity log.'],
]

/** The brand hexagon with a number or icon in it. */
function Hex({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative grid shrink-0 place-items-center ${className}`}>
      <span aria-hidden="true" className="absolute inset-0 bg-(--brand-soft)/15" style={{ mask: HEX_MASK }} />
      <span className="relative">{children}</span>
    </span>
  )
}

/**
 * The Control Centre's page: the record every Bool app reads. The hero shows pieces of what it does
 * (not its screens); then what it holds, in four groups; then, on a dark band, the one record at the
 * hub with two apps reading it along the walkways (as on the home page's map); then what that saves
 * when someone leaves.
 */
export function ControlCentre() {
  return (
    <>
      {/* the hero, on the home page's drafting paper */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="office-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-6 pb-24 pt-32 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:pt-36 2xl:max-w-[88rem]">
          <div>
            <p className="text-overline tracking-[0.28em] text-(--brand)">Control Centre</p>
            <h1 className="mt-4 text-[clamp(2.5rem,3.9vw,3.6rem)] font-light leading-[1.05] tracking-[-0.035em] text-foreground">
              The record
              <br />
              <span className="whitespace-nowrap text-(--brand)">every app reads.</span>
            </h1>
            <p className="section-lead mt-6 max-w-lg text-muted-foreground">
              Set up your organisation once: its people, places, approvals and rules. Every Bool app works from it, so change it here and it lands everywhere.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" variant="brand" className={CTA} render={<a href="mailto:sales@bool.mv?subject=Book%20a%20Bool%20demo" />}>
                Book a demo
                <ButtonArrow className={CTA_ARROW} />
              </Button>
              <Button size="lg" variant="outline" render={<a href="/#workspace" />}>
                See every app
              </Button>
            </div>
          </div>
          <Fragments />
        </div>
      </section>

      {/* what it holds */}
      <section className="border-t border-border/60">
        <Rise className="mx-auto w-full max-w-7xl px-6 py-24 2xl:max-w-[88rem]">
          <div data-rise="" className="max-w-2xl">
            <p className="text-overline tracking-[0.28em] text-muted-foreground">What it holds</p>
            <h2 className="section-title mt-4 text-foreground">
              Built from the parts your <span className="text-(--brand)">organisation already has.</span>
            </h2>
            <p className="section-lead mt-4 max-w-xl text-muted-foreground">The facts about your organisation live here, not in each app, so Inventory, HR and the rest never disagree.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {GROUPS.map(({ icon: Icon, title, lead, parts }) => (
              <article key={title} data-rise="" className="glass-card flex flex-col p-6">
                <Hex className="size-12">
                  <Icon className="size-5 text-(--brand)" strokeWidth={1.6} />
                </Hex>
                <h3 className="card-title mt-5 text-foreground">{title}</h3>
                <p className="card-body mt-1 text-muted-foreground">{lead}</p>
                <ul className="mt-5 grid gap-3 border-t border-border/70 pt-5">
                  {parts.map(([name, what]) => (
                    <li key={name} className="text-[14.5px] leading-snug">
                      <span className="font-bold text-foreground">{name}</span>
                      <span className="text-foreground/65">: {what}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Rise>
      </section>

      {/* the one record at the hub, two apps reading it along the walkways: the dark band */}
      <section className="relative overflow-hidden bg-[#2a2622]">
        <div aria-hidden="true" className="cc-stage-grid pointer-events-none absolute inset-0" />
        <Rise className="relative mx-auto w-full max-w-7xl px-6 py-24 2xl:max-w-[88rem]">
          <div data-rise="" className="mx-auto max-w-2xl text-center">
            <p className="text-overline tracking-[0.28em] text-[#f6eee3]/50">One record</p>
            <h2 className="section-title mt-4 text-[#f6eee3]">
              Every app <span className="text-(--brand-soft)">reads the same one.</span>
            </h2>
            <p className="section-lead mt-4 text-[#f6eee3]/60">Nothing is copied between apps, so nothing goes stale. Two of them, reading it right now:</p>
          </div>

          <div data-rise="" className="mt-14 grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] lg:gap-0">
            {/* Inventory, on the dark */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-[#f6eee3]">
              <div className="flex items-center gap-3">
                <Image src={inventoryLogo} alt="" className="size-9 object-contain" />
                <div>
                  <p className="card-title">Inventory</p>
                  <p className="text-[13px] text-white/50">Issue stock at Malé central</p>
                </div>
              </div>
              <ul className="mt-5 grid gap-2 text-[14px]">
                <li className="flex items-center justify-between rounded-lg bg-white/[0.06] px-4 py-2.5">
                  <span>Nadia Sorensen <span className="text-white/45">· Warehouse</span></span>
                  <span className="rounded-full bg-[#7fb38a]/15 px-2.5 py-0.5 text-[12px] font-bold text-[#a9d7b2]">Allowed</span>
                </li>
                <li className="flex items-center justify-between rounded-lg bg-white/[0.06] px-4 py-2.5">
                  <span>Hugo Fernández <span className="text-white/45">· exited</span></span>
                  <span className="rounded-full bg-[#e07a5f]/15 px-2.5 py-0.5 text-[12px] font-bold text-[#f0a48f]">Refused</span>
                </li>
              </ul>
              <p className="mt-4 text-[13px] text-white/45">Checks each person’s site access first.</p>
            </div>

            {/* the hub, with a walkway to each side */}
            <div className="relative flex justify-center py-4 lg:py-0">
              <span aria-hidden="true" className="cc-walk absolute inset-x-0 top-1/2 hidden lg:block" />
              <div className="office-hub relative grid size-24 place-items-center">
                <span aria-hidden="true" className="absolute inset-0 bg-[#fbf5ec]" style={{ mask: HEX_MASK }} />
                <span className="relative grid place-items-center text-center">
                  <SlidersHorizontal className="size-6 text-(--brand)" strokeWidth={1.7} />
                  <span className="mt-1 text-[10.5px] font-bold uppercase leading-tight tracking-[0.08em] text-foreground/75">
                    Control
                    <br />
                    Centre
                  </span>
                </span>
              </div>
            </div>

            {/* Directory, in the light */}
            <div className="rounded-2xl bg-[#fbf5ec] p-6 text-foreground">
              <div className="flex items-center gap-3">
                <Image src={directoryLogo} alt="" className="size-9 object-contain" />
                <div>
                  <p className="card-title">Directory</p>
                  <p className="text-[13px] text-muted-foreground">Engineering</p>
                </div>
              </div>
              <ul className="mt-5 grid gap-2 text-[14px]">
                {[
                  ['Platform', '12 people'],
                  ['Product Engineering', '9 people'],
                  ['Quality', '4 people'],
                ].map(([unit, n]) => (
                  <li key={unit} className="flex items-center justify-between rounded-lg bg-white/70 px-4 py-2.5">
                    <span>{unit}</span>
                    <span className="text-muted-foreground">{n}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[13px] text-muted-foreground">The same tree as Admin units, read-only.</p>
            </div>
          </div>

          <div className="mt-16 grid gap-10 border-t border-white/10 pt-12 md:grid-cols-3">
            {[
              { icon: SlidersHorizontal, title: 'Change it once', body: 'Edit a unit, a person or a site in Control Centre and every app has it on the next screen.' },
              { icon: Users, title: 'Roles, not names', body: 'Approvals and notifications point at roles like “site manager”, so they keep working when people change.' },
              { icon: Activity, title: 'On the record', body: 'Every change, in every app, lands in one activity log that nobody can edit.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} data-rise="">
                <Hex className="size-12 [&>span:first-child]:bg-white/10">
                  <Icon className="size-5 text-(--brand-soft)" strokeWidth={1.6} />
                </Hex>
                <h3 className="card-title mt-5 text-[#f6eee3]">{title}</h3>
                <p className="card-body mt-2 text-[#f6eee3]/60">{body}</p>
              </div>
            ))}
          </div>
        </Rise>
      </section>

      {/* what that saves: one person leaving */}
      <section className="border-t border-border/60">
        <Rise className="mx-auto w-full max-w-7xl px-6 py-24 2xl:max-w-[88rem]">
          <div data-rise="" className="max-w-2xl">
            <p className="text-overline tracking-[0.28em] text-muted-foreground">When someone leaves</p>
            <h2 className="section-title mt-4 text-foreground">
              One change. <span className="text-(--brand)">No loose ends.</span>
            </h2>
            <p className="section-lead mt-4 max-w-xl text-muted-foreground">Without one record, an exit is a list of apps to visit. With Control Centre it is a single step, and the rest follows.</p>
          </div>
          <ol className="relative mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            <span aria-hidden="true" className="cc-walk absolute left-6 right-[12%] top-6 hidden lg:block" />
            {LEAVING.map(([title, body], i) => (
              <li key={title} data-rise="" className="relative">
                <Hex className="size-12 bg-background [&>span:first-child]:bg-(--brand-soft)/20">
                  <span className="text-[15px] font-bold tabular-nums text-(--brand)">{i + 1}</span>
                </Hex>
                <h3 className="card-title mt-5 text-foreground">{title}</h3>
                <p className="card-body mt-2 text-foreground/70">{body}</p>
              </li>
            ))}
          </ol>
        </Rise>
      </section>
    </>
  )
}
