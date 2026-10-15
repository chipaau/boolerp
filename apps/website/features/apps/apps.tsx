import Image, { type StaticImageData } from 'next/image'
import { Rise } from '@/components/rise'
import analytics from '@workspace/assets/logos/analytics.png'
import asset from '@workspace/assets/logos/asset.png'
import controlCentre from '@workspace/assets/logos/control-centre-glyph.png'
import directory from '@workspace/assets/logos/directory.png'
import inventory from '@workspace/assets/logos/inventory.png'
import notes from '@workspace/assets/logos/notes-glyph.png'
import procurement from '@workspace/assets/logos/procurement.png'
import task from '@workspace/assets/logos/task.png'
import { cn } from '@workspace/ui/lib/utils'

/**
 * The apps, in a bento grid under the hero: the apps that exist today as large cards with a real
 * screen of each (captured from the running workspace by scripts/demo-recording/screens.mjs, on the
 * same morning as the hero's dashboard and demo), then the apps still to come as small cards with
 * their icon and a line, never a screen that does not exist. Icons are the workspace's own
 * (apps/workspace/src/components/app-icon.tsx; Calendar reuses Procurement's illustration there too).
 */
// `frame`: how far the card's view of the screen zooms in (1 = the whole width) and the point it zooms toward
type Shown = { app: string; icon: StaticImageData; title: string; body: string; screen: string; span: string; frame: { zoom: number; at: string } }

const SHOWN: Shown[] = [
  {
    app: 'Inventory',
    icon: inventory,
    title: 'Stock that flags itself',
    body: 'Stock in and out across every site, with low stock and waiting approvals surfaced before they become problems.',
    screen: '/apps/inventory.webp',
    span: 'lg:col-span-4 lg:row-span-2',
    frame: { zoom: 1, at: '0 0' },
  },
  {
    app: 'Control Centre',
    icon: controlCentre,
    title: 'Set up once, used everywhere',
    body: 'Sites, people, groups and approval chains, kept in one place every app reads.',
    screen: '/apps/control-centre.webp',
    span: 'lg:col-span-2 lg:row-span-2',
    frame: { zoom: 1.9, at: '40% 0' },
  },
  {
    app: 'Calendar',
    icon: procurement,
    title: 'Meetings in a few keystrokes',
    body: 'Shared calendars, rooms and invites, with the day’s agenda at a glance.',
    screen: '/apps/calendar.webp',
    span: 'lg:col-span-3',
    frame: { zoom: 1.55, at: '100% 78%' }, // the week of the 23rd and the day's agenda
  },
  {
    app: 'Directory',
    icon: directory,
    title: 'Everyone, and where they sit',
    body: 'People, teams and the org chart, always current from Control Centre.',
    screen: '/apps/directory.webp',
    span: 'lg:col-span-3',
    frame: { zoom: 1.55, at: '40% 0' },
  },
]

const COMING: { app: string; icon: StaticImageData; body: string }[] = [
  { app: 'Tasks', icon: task, body: 'Work assigned, due and done.' },
  { app: 'Assets', icon: asset, body: 'Equipment, who has it, and its checks.' },
  { app: 'Procurement', icon: procurement, body: 'Requests, approvals and orders.' },
  { app: 'Notes', icon: notes, body: 'Shared notes beside the work.' },
  { app: 'Analytics', icon: analytics, body: 'The numbers across every app.' },
]

export function Apps() {
  return (
    <section id="product" className="relative bg-background py-24 lg:pb-32 lg:pt-12">
      <Rise className="mx-auto max-w-7xl px-6 2xl:max-w-[88rem]">
        <div data-rise="" className="max-w-2xl">
          <p className="text-overline tracking-[0.28em] text-muted-foreground">The apps</p>
          <h2 className="mt-4 text-balance text-[clamp(2rem,3vw,3rem)] font-light leading-[1.05] tracking-[-0.03em] text-foreground">
            Every app your team runs on, sharing one record.
          </h2>
          <p className="mt-5 max-w-xl text-pretty text-[clamp(1rem,1.2vw,1.125rem)] leading-snug text-muted-foreground">
            Set people, sites and approvals up once in Control Centre, and every app works from them: no copying, no drift.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:auto-rows-[minmax(17rem,auto)] lg:grid-cols-6 lg:gap-5">
          {SHOWN.map((a) => (
            <ScreenCard key={a.app} {...a} />
          ))}
        </div>
        <div data-rise="" className="app-card mt-4 grid gap-6 p-6 sm:grid-cols-2 md:grid-cols-3 lg:mt-5 lg:grid-cols-5 lg:p-8">
            <p className="text-overline tracking-[0.28em] text-muted-foreground sm:col-span-full">Coming to the workspace</p>
            {COMING.map(({ app, icon, body }) => (
              <div key={app} className="flex items-start gap-3">
                <AppMark icon={icon} />
                <div className="leading-snug">
                  <p className="font-medium text-foreground">{app}</p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
        </div>
      </Rise>
    </section>
  )
}

/** An app that exists: its name and a line above, a real screen of it below, bleeding off the card's edge. */
function ScreenCard({ app, icon, title, body, screen, span, frame }: Shown) {
  return (
    <article data-rise="" className={cn('app-card group flex flex-col overflow-hidden', span)}>
      <div className="flex items-start gap-3 p-6 pb-5 lg:p-7 lg:pb-5">
        <AppMark icon={icon} />
        <div className="leading-snug">
          <p className="text-sm text-muted-foreground">{app}</p>
          <h3 className="text-lg font-medium text-foreground">{title}</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
      <div className="relative ml-6 min-h-52 flex-1 overflow-hidden rounded-tl-xl shadow-[0_0_0_1px_rgb(168_148_118/0.25),0_10px_30px_-12px_rgb(110_76_36/0.3)] lg:ml-7">
        <div className="absolute inset-0" style={{ transform: `scale(${frame.zoom})`, transformOrigin: frame.at }}>
          <Image
            src={screen}
            alt={`The ${app} app`}
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover object-left-top transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        </div>
      </div>
    </article>
  )
}

/** An app's own icon on a small cream hexagon, as on the dashboard and the hero's notifications. */
function AppMark({ icon }: { icon: StaticImageData }) {
  return (
    <span className="app-mark grid size-11 shrink-0 place-items-center bg-[#f7f1e8]">
      <Image src={icon} alt="" className="h-[52%] w-auto" />
    </span>
  )
}
