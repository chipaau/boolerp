import { Link } from '@tanstack/react-router'
import { Boxes, Download, ListChecks, Plus, UserRound } from 'lucide-react'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { HexGlyph } from '@workspace/ui/components/hex-glyph'
import { Sparkline } from '@workspace/ui/components/sparkline'
import { cn } from '@workspace/ui/lib/utils'
import { APPROVALS, CATEGORIES, LOW_STOCK, MOVEMENTS, SERIES, money, summary } from './data'
import { StockChart } from './stock-chart'

const RAMP = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']

/** The Inventory overview: headline KPIs, stock in/out with the movement log, approvals, categories, low stock, quick actions. */
export function InventoryOverviewPage() {
  const s = summary()
  const spark = SERIES['30d']
  const today = new Date()
  const dateLine = `${today.toLocaleDateString('en-GB', { weekday: 'long' })} · ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`

  return (
    <div className="px-12 pt-10 pb-28">
      {/* title row */}
      <div className="mb-[34px] flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 flex-1 basis-[300px]">
          <div className="mb-2 text-overline text-faint">{dateLine}</div>
          <h1 className="text-[30px] leading-none font-medium tracking-[-0.022em] text-foreground">Inventory overview</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-4">
            <span className="text-sm text-muted-foreground">Warehouse A, B &amp; Site store</span>
            <Badge variant="warning" size="sm" render={<Link to="/$app/$section" params={{ app: 'inventory', section: 'purchase-orders' }} />}>
              1 purchase order overdue
            </Badge>
          </div>
        </div>
        <div className="ms-auto flex items-center gap-2.5">
          <Button variant="ghost" className="text-muted-foreground">
            <Download strokeWidth={1.7} />
            Export
          </Button>
          <Button>
            Add item
            <ButtonArrow>
              <Plus strokeWidth={2.2} />
            </ButtonArrow>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-[18px] grid grid-cols-2 gap-[18px] md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Units on hand" value={s.unitsOnHand.toLocaleString()} delay={0} to="items">
          <Delta up>↑ 4.2%</Delta>
          <span className="text-caption text-muted-foreground">vs last month</span>
          <Sparkline values={spark.onHand} className="mt-[15px] text-chart-line-a" />
        </Kpi>
        <Kpi label="Below reorder" value={String(s.lowCount)} valueClass="text-tone-risk-foreground" delay={40} to="low-stock">
          <span className="text-caption text-muted-foreground">2 critical · 2 warning</span>
          <Sparkline values={spark.low} className="mt-[15px] text-chart-line-b" />
        </Kpi>
        <Kpi label="Issued out" value={s.issuedOut.toLocaleString()} delay={80} to="items" search={{ filter: 'Issued' }}>
          <span className="text-caption text-muted-foreground">Across 68 staff</span>
          <Sparkline values={spark.issued} className="mt-[15px] text-chart-fill" />
        </Kpi>
        <Kpi label="Pending approvals" value="5" valueClass="text-tone-warning-deep" delay={120} to="requests">
          <span className="text-caption text-muted-foreground">Oldest waiting 2 days</span>
        </Kpi>
        <div className="animate-rise rounded-lg bg-surface-inverted p-6 [animation-delay:160ms]">
          <div className="text-[11.5px] font-bold tracking-[0.1em] text-surface-inverted-foreground/65 uppercase">Total value</div>
          <div className="mt-2 text-[34px] leading-[1.1] font-bold text-surface-inverted-foreground">{money(s.stockValue)}</div>
          <div className="mt-2 text-caption text-surface-inverted-foreground/65">{s.locations.length} locations</div>
        </div>
      </div>

      {/* chart + movements */}
      <Card className="mb-[18px] grid gap-0 py-0 lg:grid-cols-[minmax(0,1.75fr)_minmax(240px,0.85fr)]">
        <div className="min-w-0 p-7">
          <StockChart />
        </div>
        <div className="flex min-w-0 flex-col border-t border-divider p-[26px] pb-5 lg:border-t-0 lg:border-l">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[15px] font-bold text-foreground">Recent movements</div>
            <Button variant="link" size="sm">
              Log
            </Button>
          </div>
          <ol className="max-h-[286px] overflow-y-auto pr-2.5">
            {MOVEMENTS.map((m, i) => (
              <li key={m.text} className="flex gap-3">
                <div className="flex w-3 shrink-0 flex-col items-center pt-[3px]">
                  <HexGlyph size={14} className={i === 0 ? 'text-brand-soft' : 'text-border'} />
                  {i < MOVEMENTS.length - 1 && <span className="my-[5px] w-px flex-1 bg-border" />}
                </div>
                <div className="min-w-0 flex-1 pb-[15px]">
                  <div className="text-[13px] leading-[1.45] text-body">{m.text}</div>
                  <div className="mt-[3px] text-[11.5px] text-faint">{m.time}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      {/* two columns */}
      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
        <div className="flex flex-col gap-[18px]">
          <Card className="overflow-hidden py-0">
            <div className="flex items-center justify-between border-b border-divider px-6 py-[19px]">
              <div className="text-[15.5px] font-bold text-foreground">Pending approvals</div>
              <Button variant="link" size="sm" render={<Link to="/$app/$section" params={{ app: 'inventory', section: 'requests' }} />}>
                View all
              </Button>
            </div>
            <ul>
              {APPROVALS.map((a) => (
                <li key={a.id} className="flex items-center gap-[13px] border-b border-divider px-6 py-[15px] last:border-b-0">
                  <Avatar name={a.who} className="size-[34px] bg-muted">
                    <AvatarFallback className="bg-muted text-muted-foreground" />
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-bold text-foreground">{a.title}</span>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', a.urgent ? 'bg-tone-warning-soft text-tone-warning-foreground' : 'text-faint')}>
                        {a.age}
                      </span>
                    </div>
                    <div className="mt-[3px] truncate text-[12.5px] text-muted-foreground">{a.meta}</div>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" className="h-[30px] text-[12.5px]">
                      Decline
                    </Button>
                    <Button size="sm" className="h-[30px] px-4 text-[12.5px]">
                      Approve
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="py-7">
            <div className="flex items-start justify-between px-7">
              <div>
                <div className="text-[15.5px] font-bold text-foreground">Stock by category</div>
                <div className="mt-0.5 text-caption text-muted-foreground">Units on hand, all locations</div>
              </div>
              <Badge variant="filter">This month</Badge>
            </div>
            <div className="mt-1 flex flex-col gap-[18px] px-7">
              {CATEGORIES.map((c, i) => {
                const riskW = c.pct * (c.risk / 100)
                return (
                  <div key={c.name}>
                    <div className="mb-[7px] flex items-baseline justify-between gap-3">
                      <span className="text-[13.5px] text-body">{c.name}</span>
                      <span className="flex items-baseline gap-2">
                        {c.risk > 0 && (
                          <span className="rounded-full bg-tone-risk-soft px-2 py-0.5 text-[11.5px] font-bold text-tone-risk-foreground">
                            {Math.round((c.value * c.risk) / 100)} at risk
                          </span>
                        )}
                        <span className="text-sm font-bold text-foreground">{c.value.toLocaleString()}</span>
                        <span className="text-xs text-faint">units</span>
                      </span>
                    </div>
                    <span className="flex h-2.5 rounded-full bg-muted">
                      <span className={cn('block h-full rounded-full transition-[width] duration-[620ms] ease-hexa', RAMP[i % 5])} style={{ width: `${c.pct - riskW}%` }} />
                      {riskW > 0 && <span className="ml-[3px] block h-full min-w-[15px] rounded-full bg-chart-risk" style={{ width: `${riskW}%` }} />}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mx-7 mt-6 flex gap-[22px] border-t border-divider pt-4 text-[12.5px] text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="flex gap-0.5">
                  <span className="h-2.5 w-[9px] rounded-l-full bg-chart-1" />
                  <span className="h-2.5 w-[9px] bg-chart-3" />
                  <span className="h-2.5 w-[9px] rounded-r-full bg-chart-5" />
                </span>
                Above reorder point
              </span>
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-chart-risk" />
                At or below reorder point
              </span>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-[18px]">
          <Card className="overflow-hidden py-0">
            <div className="flex items-center justify-between gap-3.5 border-b border-divider px-6 py-[19px]">
              <div>
                <div className="text-[15.5px] font-bold text-foreground">Below reorder level</div>
                <div className="mt-0.5 text-caption text-muted-foreground">Ordered by urgency</div>
              </div>
              <Button variant="link" size="sm" render={<Link to="/$app/$section" params={{ app: 'inventory', section: 'low-stock' }} />}>
                View all
              </Button>
            </div>
            <ul>
              {LOW_STOCK.map((l) => (
                <li key={l.name} className="group flex cursor-pointer items-center gap-4 border-b border-divider px-6 py-[17px] transition-colors duration-instant ease-hexa last:border-b-0 hover:bg-surface-soft">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-surface-soft">
                    <Boxes className="size-4 text-faint" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2.5">
                      <span className="truncate text-ui font-bold text-foreground">{l.name}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Button variant="outline" size="xs" className="h-[26px] px-[11px] text-[11.5px] opacity-0 transition-opacity duration-instant group-hover:opacity-100">
                          Reorder
                        </Button>
                        <Badge variant={l.tag === 'Critical' ? 'risk' : 'warning'} size="sm">
                          {l.tag}
                        </Badge>
                      </span>
                    </div>
                    <div className="mt-[3px] truncate text-caption text-muted-foreground">{l.meta}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="py-7">
            <div className="px-7 text-[15.5px] font-bold text-foreground">Quick actions</div>
            <div className="mt-3.5 grid grid-cols-2 gap-[9px] px-7">
              <QuickAction icon={<Plus strokeWidth={1.5} />} label="Add item" />
              <QuickAction icon={<ListChecks strokeWidth={1.5} />} label="Stock count" />
              <QuickAction icon={<UserRound strokeWidth={1.5} />} label="Issue to person" />
              <QuickAction icon={<HexGlyph size={16} className="text-brand-soft" />} label="Reorder request" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  valueClass,
  delay,
  to,
  search,
  children,
}: {
  label: string
  value: string
  valueClass?: string
  delay: number
  to: string
  search?: Record<string, string>
  children?: React.ReactNode
}) {
  return (
    <Link
      to="/$app/$section"
      params={{ app: 'inventory', section: to }}
      search={search}
      className="lift block animate-rise rounded-lg bg-card p-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-[11.5px] font-bold tracking-[0.1em] text-muted-foreground uppercase">{label}</div>
      <div className={cn('mt-2 text-[34px] leading-[1.1] font-bold text-foreground', valueClass)}>{value}</div>
      <div className="mt-[7px] flex flex-wrap items-center gap-[7px]">{children}</div>
    </Link>
  )
}

function Delta({ up, children }: { up?: boolean; children: React.ReactNode }) {
  return <span className={cn('text-caption font-bold', up ? 'text-link' : 'text-tone-risk-foreground')}>{children}</span>
}

function QuickAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="group flex items-center gap-[11px] rounded-[10px] bg-muted px-3.5 py-[13px] text-left outline-none transition-colors duration-instant ease-hexa hover:bg-secondary-hover focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid size-[34px] shrink-0 place-items-center rounded-[11px] bg-surface-soft text-brand-soft shadow-[inset_0_0_0_1px_rgba(180,152,104,0.16)] [&>svg]:size-[18px]">
        {icon}
      </span>
      <span className="text-[13.5px] font-bold text-foreground">{label}</span>
    </button>
  )
}
