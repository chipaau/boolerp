import { Hexagon } from '@workspace/ui/components/hexagon'
import { AppsHoneycomb } from './apps-honeycomb'
import { Greeting } from './greeting'
import { MonthHoneycomb } from './month-honeycomb'
import { Schedule } from './schedule'
import { SmartInbox } from './smart-inbox'

/**
 * Workspace home: greeting + day at a glance on the left, the apps honeycomb on the right.
 * The left column is capped so the page keeps the wide breathing room of the design between the
 * inbox and the apps panel; sections rise in with a short stagger. Two very faint rotated
 * hexagons sit behind the greeting, as in the Figma file.
 */
export function HomePage() {
  const today = new Date()
  return (
    <div className="relative min-h-0 w-full overflow-x-hidden overflow-y-auto">
      <Hexagon
        aria-hidden="true"
        size="26rem"
        gradient={['var(--hex-decor-from)', 'var(--hex-decor-to)']}
        className="pointer-events-none absolute -top-40 -left-24 rotate-[22deg] opacity-40"
      />
      <Hexagon
        aria-hidden="true"
        size="22rem"
        gradient={['var(--hex-decor-from)', 'var(--hex-decor-to)']}
        className="pointer-events-none absolute top-6 left-40 rotate-[-14deg] opacity-30"
      />
      <div className="relative mx-auto flex max-w-[1600px] flex-col gap-16 px-8 py-9 lg:flex-row lg:justify-between lg:gap-20 lg:px-16 xl:gap-28 2xl:gap-40">
        <div className="min-w-0 flex-1 space-y-20 lg:max-w-[46rem]">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-14">
            <div className="space-y-9">
              <div className="animate-rise">
                <Greeting today={today} />
              </div>
              <div className="animate-rise [animation-delay:120ms]">
                <Schedule />
              </div>
            </div>
            <div className="animate-rise [animation-delay:80ms]">
              <MonthHoneycomb today={today} />
            </div>
          </div>
          <div className="animate-rise [animation-delay:160ms]">
            <SmartInbox />
          </div>
        </div>
        <aside className="min-w-0 shrink-0 animate-rise [animation-delay:200ms] lg:w-[30rem]">
          <AppsHoneycomb />
        </aside>
      </div>
    </div>
  )
}
