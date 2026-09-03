import { Link } from '@tanstack/react-router'
import { Boxes, Download, ListChecks, Plus, UserRound } from 'lucide-react'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { HexGlyph } from '@workspace/ui/components/hex-glyph'
import { ListRow } from '@workspace/ui/components/list-row'
import { QuickAction } from '@workspace/ui/components/quick-action'
import { Sparkline } from '@workspace/ui/components/sparkline'
import { StatCard, StatDelta } from '@workspace/ui/components/stat-card'
import { cn } from '@workspace/ui/lib/utils'
import { PageTitle } from '@/components/layout/page'
import { dateOverline } from '@/lib/dates'
import { compactNumber, summarize } from './logic'
import { useApprovals, useCategories, useItems, useLowStock, useMovements, useOverviewStats, useStockSeries } from './queries'
import { StockChart } from './stock-chart'

const RAMP = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']

/** The Inventory overview: headline KPIs, stock in/out with the movement log, approvals, categories, low stock, quick actions. */
export function InventoryOverviewPage() {
  const s = summarize(useItems())
  const spark = useStockSeries('30d')
  const movements = useMovements()
  const approvals = useApprovals()
  const categories = useCategories()
  const lowStock = useLowStock()
  const o = useOverviewStats()
  const critical = lowStock.filter((l) => l.tag === 'Critical').length
  const unitsUp = o.unitsDeltaPct >= 0

  return (
    <div className="px-12 pt-10 pb-28">
      <PageTitle
        overline={dateOverline(new Date())}
        title="Inventory overview"
        meta={
          <>
            <span>Warehouse A, B &amp; Site store</span>
            {o.overduePurchaseOrders > 0 && (
              <Badge variant="warning" size="sm" render={<Link to="/$app/$section" params={{ app: 'inventory', section: 'purchase-orders' }} />}>
                {o.overduePurchaseOrders} purchase {o.overduePurchaseOrders === 1 ? 'order' : 'orders'} overdue
              </Badge>
            )}
          </>
        }
        actions={
          <>
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
          </>
        }
      />

      {/* KPIs */}
      <div className="mb-[18px] grid grid-cols-2 gap-[18px] md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Units on hand" value={s.unitsOnHand.toLocaleString()} className="animate-rise" style={{ animationDelay: '0ms' }} render={<Link to="/$app/$section" params={{ app: 'inventory', section: 'items' }} />}>
          <StatDelta up={unitsUp}>{unitsUp ? '↑' : '↓'} {Math.abs(o.unitsDeltaPct).toFixed(1)}%</StatDelta>
          <span className="text-caption text-muted-foreground">vs last month</span>
          <Sparkline values={spark.onHand} className="mt-[15px] text-chart-line-a" />
        </StatCard>
        <StatCard label="Below reorder" value={String(s.lowCount)} valueClassName="text-tone-risk-foreground" className="animate-rise" style={{ animationDelay: '40ms' }} render={<Link to="/$app/$section" params={{ app: 'inventory', section: 'low-stock' }} />}>
          <span className="text-caption text-muted-foreground">{critical} critical · {lowStock.length - critical} warning</span>
          <Sparkline values={spark.low} className="mt-[15px] text-chart-line-b" />
        </StatCard>
        <StatCard label="Issued out" value={s.issuedOut.toLocaleString()} className="animate-rise" style={{ animationDelay: '80ms' }} render={<Link to="/$app/$section" params={{ app: 'inventory', section: 'items' }} search={{ filter: 'Issued' }} />}>
          <span className="text-caption text-muted-foreground">Across {o.issuedToStaff} staff</span>
          <Sparkline values={spark.issued} className="mt-[15px] text-chart-fill" />
        </StatCard>
        <StatCard label="Pending approvals" value={String(approvals.length)} valueClassName="text-tone-warning-deep" className="animate-rise" style={{ animationDelay: '120ms' }} render={<Link to="/$app/$section" params={{ app: 'inventory', section: 'requests' }} />}>
          <span className="text-caption text-muted-foreground">Oldest waiting {o.oldestApprovalDays} {o.oldestApprovalDays === 1 ? 'day' : 'days'}</span>
        </StatCard>
        <StatCard
          variant="inverted"
          label="Total value"
          value={
            <>
              <span className="me-1.5 text-[15px] font-bold tracking-[0.06em] text-surface-inverted-foreground/65">MVR</span>
              {compactNumber(s.stockValue)}
            </>
          }
          className="animate-rise [animation-delay:160ms]"
        >
          <span className="text-caption text-surface-inverted-foreground/65">{s.locations.length} locations</span>
        </StatCard>
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
            {movements.map((m, i) => (
              <li key={m.text} className="flex gap-3">
                <div className="flex w-3 shrink-0 flex-col items-center pt-[3px]">
                  <HexGlyph size={14} className={i === 0 ? 'text-brand-soft' : 'text-border'} />
                  {i < movements.length - 1 && <span className="my-[5px] w-px flex-1 bg-border" />}
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
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex items-center justify-between border-b border-divider px-6 py-[19px]">
              <div className="text-[15.5px] font-bold text-foreground">Pending approvals</div>
              <Button variant="link" size="sm" render={<Link to="/$app/$section" params={{ app: 'inventory', section: 'requests' }} />}>
                View all
              </Button>
            </div>
            <ul>
              {approvals.map((a) => (
                <ListRow
                  key={a.id}
                  leading={
                    <Avatar name={a.who} className="size-[34px] bg-muted">
                      <AvatarFallback className="bg-muted text-muted-foreground" />
                    </Avatar>
                  }
                  heading={<span className="truncate text-sm font-bold text-foreground">{a.title}</span>}
                  aside={
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', a.urgent ? 'bg-tone-warning-soft text-tone-warning-foreground' : 'text-faint')}>
                      {a.age}
                    </span>
                  }
                  meta={a.meta}
                  trailing={
                    <span className="flex shrink-0 items-center gap-2">
                      <Button variant="outline" size="sm" className="h-[30px] text-[12.5px]">
                        Decline
                      </Button>
                      <Button size="sm" className="h-[30px] px-4 text-[12.5px]">
                        Approve
                      </Button>
                    </span>
                  }
                />
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
              {categories.map((c, i) => {
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
          <Card className="gap-0 overflow-hidden py-0">
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
              {lowStock.map((l) => (
                <ListRow
                  key={l.name}
                  interactive
                  className="gap-4 py-[17px]"
                  leading={
                    <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-surface-soft">
                      <Boxes className="size-4 text-faint" strokeWidth={1.5} />
                    </span>
                  }
                  heading={<span className="truncate text-ui font-bold text-foreground">{l.name}</span>}
                  aside={
                    <span className="flex shrink-0 items-center gap-2">
                      <Button variant="outline" size="xs" className="h-[26px] px-[11px] text-[11.5px] opacity-0 transition-opacity duration-instant group-hover:opacity-100">
                        Reorder
                      </Button>
                      <Badge variant={l.tag === 'Critical' ? 'risk' : 'warning'} size="sm">
                        {l.tag}
                      </Badge>
                    </span>
                  }
                  meta={l.meta}
                />
              ))}
            </ul>
          </Card>

          <Card className="py-7">
            <div className="px-7 text-[15.5px] font-bold text-foreground">Quick actions</div>
            <div className="mt-3.5 grid grid-cols-2 gap-[9px] px-7">
              <QuickAction icon={<Plus strokeWidth={1.5} />}>Add item</QuickAction>
              <QuickAction icon={<ListChecks strokeWidth={1.5} />}>Stock count</QuickAction>
              <QuickAction icon={<UserRound strokeWidth={1.5} />}>Issue to person</QuickAction>
              <QuickAction icon={<HexGlyph size={16} />}>Reorder request</QuickAction>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
