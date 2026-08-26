// PROTOTYPE UI — everything under src/proto is placeholder. Routes render <ProtoPage/> so a real
// screen replaces it with a one-line change (swap the component in the route). Delete this folder
// when every feature has a real page. Mock data is static and obviously fake.
import { ChevronRight, MoreHorizontal, Plus, Search } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { PageHeader } from '@/components/layout/page'
import type { AppDef, AppMenuItem, ProtoVariant } from '@/lib/apps'

const NAMES = [
  ['Aishath Nasheed', 'AN'],
  ['Mohamed Waheed', 'MW'],
  ['Fathimath Ali', 'FA'],
  ['Ibrahim Rasheed', 'IR'],
  ['Mariyam Shifa', 'MS'],
  ['Ahmed Zayan', 'AZ'],
  ['Hawwa Leena', 'HL'],
  ['Yoosuf Naail', 'YN'],
] as const

const STATUSES = ['Active', 'Pending', 'Draft', 'Active', 'Review', 'Active'] as const

const rows = NAMES.map(([name, initials], i) => ({
  name,
  initials,
  ref: `#${(1042 + i * 7).toString()}`,
  updated: `${(i % 9) + 1}d ago`,
  meta: ['Māle City', 'Finance', 'Operations', 'HR', 'Registry'][i % 5],
  status: STATUSES[i % STATUSES.length],
}))

const stats = [
  { label: 'Total', value: '1,284', delta: '+4.2% this month' },
  { label: 'Active', value: '976', delta: '+1.1% this week' },
  { label: 'Pending', value: '38', delta: '5 need attention' },
  { label: 'This month', value: '212', delta: '+18 vs last' },
]

function ProtoBadge() {
  return (
    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      Prototype
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'Active'
      ? 'bg-primary/10 text-primary'
      : status === 'Pending' || status === 'Review'
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'bg-muted text-muted-foreground'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>
}

function Dashboard() {
  const bars = [42, 66, 51, 80, 58, 72, 55, 90, 68, 76, 61, 84]
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{s.value}</div>
              <div className="mt-1 text-xs text-primary">{s.delta}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-2">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.slice(0, 5).map((r) => (
              <div key={r.name} className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {r.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.meta} · {r.updated}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Toolbar({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 border-b p-3">
      <div className="relative max-w-xs flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input placeholder={`Search ${label.toLowerCase()}…`} className="pl-8" />
      </div>
      <Button size="sm">
        <Plus className="size-4" /> New
      </Button>
    </div>
  )
}

function TableView({ label }: { label: string }) {
  return (
    <Card className="overflow-hidden py-0">
      <Toolbar label={label} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Reference</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-xs font-medium text-primary">
                      {r.initials}
                    </div>
                    <span className="font-medium">{r.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.ref}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.updated}</td>
                <td className="px-4 py-2.5">
                  <StatusPill status={r.status} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" size="icon" className="size-7">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function ListView({ label }: { label: string }) {
  return (
    <Card className="overflow-hidden py-0">
      <Toolbar label={label} />
      <div>
        {rows.map((r) => (
          <div
            key={r.name}
            className="flex items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/40"
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {r.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {r.meta} · {r.ref}
              </div>
            </div>
            <StatusPill status={r.status} />
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    </Card>
  )
}

function CalendarView() {
  const days = Array.from({ length: 35 }, (_, i) => i - 2) // leading blanks
  const events: Record<number, string> = { 3: 'Board', 8: 'Review', 12: 'Leave', 17: 'Audit', 21: 'Town hall', 26: 'Payroll' }
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return (
    <Card className="overflow-hidden py-0">
      <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
        {dow.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => (
          <div key={i} className="min-h-24 border-b border-r p-2 last:border-r-0 [&:nth-child(7n)]:border-r-0">
            {d > 0 && d <= 30 && (
              <>
                <div className="text-xs text-muted-foreground">{d}</div>
                {events[d] && (
                  <div className="mt-1 truncate rounded bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
                    {events[d]}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

export function ProtoPage({ app, item }: { app: AppDef; item: AppMenuItem }) {
  const variant: ProtoVariant = item.variant ?? 'dashboard'
  return (
    <>
      <PageHeader title={item.title} description={app.name} actions={<ProtoBadge />} />
      <div className="p-6">
        {variant === 'dashboard' && <Dashboard />}
        {variant === 'table' && <TableView label={item.title} />}
        {variant === 'list' && <ListView label={item.title} />}
        {variant === 'calendar' && <CalendarView />}
      </div>
    </>
  )
}
