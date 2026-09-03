// PROTOTYPE UI — everything under src/proto is placeholder. Routes render <ProtoPage/> so a real
// screen replaces it with a one-line change (swap the component in the route). Delete this folder
// when every feature has a real page. Mock data is static and obviously fake. Built only from the
// shared components so it doubles as a living check of the design system.
import { useState } from 'react'
import { ChevronRight, MoreHorizontal, Plus } from 'lucide-react'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { Button, ButtonArrow } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { ListRow } from '@workspace/ui/components/list-row'
import { SearchField } from '@workspace/ui/components/search-field'
import {
  Table,
  TableBody,
  TableBulkAction,
  TableBulkBar,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  TableToolbar,
} from '@workspace/ui/components/table'
import { PageHeader } from '@/components/layout/page'
import type { AppDef, AppMenuItem } from '@/lib/apps'
import { variantFor } from './variants'

const NAMES = [
  'Aishath Nasheed',
  'Mohamed Waheed',
  'Fathimath Ali',
  'Ibrahim Rasheed',
  'Mariyam Shifa',
  'Ahmed Zayan',
  'Hawwa Leena',
  'Yoosuf Naail',
] as const

type Status = 'Active' | 'Pending' | 'Draft' | 'Review'
const STATUSES: Status[] = ['Active', 'Pending', 'Draft', 'Active', 'Review', 'Active']
const STATUS_TONE: Record<Status, 'success' | 'warning' | 'neutral' | 'plum'> = {
  Active: 'success',
  Pending: 'warning',
  Draft: 'neutral',
  Review: 'plum',
}

const rows = NAMES.map((name, i) => ({
  name,
  ref: `#${(1042 + i * 7).toString()}`,
  updated: `${(i % 9) + 1}d ago`,
  qty: 4 + ((i * 37) % 60),
  meta: ['Māle City', 'Finance', 'Operations', 'HR', 'Registry'][i % 5],
  status: STATUSES[i % STATUSES.length],
}))

const stats = [
  { label: 'Total', value: '1,284', delta: '↑ 4.2%', hint: 'vs last month' },
  { label: 'Active', value: '976', delta: '↑ 1.1%', hint: 'this week' },
  { label: 'Pending', value: '38', delta: '5', hint: 'need attention' },
  { label: 'This month', value: '212', delta: '+18', hint: 'vs last' },
]

function Dashboard() {
  const bars = [42, 66, 51, 80, 58, 72, 55, 90, 68, 76, 61, 84]
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent>
              <div className="text-[11.5px] font-bold tracking-[0.1em] text-muted-foreground uppercase">{s.label}</div>
              <div className="mt-2.5 text-[34px] leading-[1.1] font-bold tabular-nums text-foreground">{s.value}</div>
              <div className="mt-2 flex items-center gap-1.5 text-caption">
                <span className="font-bold text-link">{s.delta}</span>
                <span className="text-muted-foreground">{s.hint}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Movements, 12 weeks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-2">
              {bars.map((h, i) => (
                <div key={i} className="flex flex-1 flex-col justify-end gap-0.5">
                  <div className="rounded-t-[3px] bg-chart-line-a" style={{ height: `${h * 0.55}%` }} />
                  <div className="bg-chart-line-b" style={{ height: `${h * 0.4}%` }} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {rows.slice(0, 5).map((r) => (
              <div key={r.name} className="flex items-center gap-3">
                <Avatar name={r.name}>
                  <AvatarFallback />
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ui font-bold text-foreground">{r.name}</div>
                  <div className="truncate text-caption text-muted-foreground">
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
    <TableToolbar>
      <SearchField size="sm" placeholder={`Filter ${label.toLowerCase()}…`} className="max-w-xs" />
      <Badge variant="filter-active" render={<button type="button" />}>
        All
      </Badge>
      <Badge variant="filter" render={<button type="button" />}>
        Active
      </Badge>
      <Badge variant="filter" render={<button type="button" />}>
        Pending
      </Badge>
      <span className="flex-1" />
      <Button size="sm">
        New
        <ButtonArrow>
          <Plus strokeWidth={2.2} />
        </ButtonArrow>
      </Button>
    </TableToolbar>
  )
}

function TableView({ label }: { label: string }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [page, setPage] = useState(1)
  const count = Object.values(selected).filter(Boolean).length
  const allSelected = count === rows.length
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Toolbar label={label} />
      <Table>
        <TableHeader>
          <TableRow className="h-auto hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select all"
                checked={allSelected}
                indeterminate={count > 0 && !allSelected}
                onCheckedChange={(v) => setSelected(v ? Object.fromEntries(rows.map((r) => [r.name, true])) : {})}
              />
            </TableHead>
            <TableHead sortable sorted="asc">
              Name
            </TableHead>
            <TableHead>Reference</TableHead>
            <TableHead align="center">Qty</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead align="center">Status</TableHead>
            <TableHead align="right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name} selected={!!selected[r.name]}>
              <TableCell>
                <Checkbox
                  aria-label={`Select ${r.name}`}
                  checked={!!selected[r.name]}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, [r.name]: !!v }))}
                />
              </TableCell>
              <TableCell className="font-bold text-foreground">{r.name}</TableCell>
              <TableCell className="text-muted-foreground">{r.ref}</TableCell>
              <TableCell align="center" numeric>
                {r.qty}
              </TableCell>
              <TableCell className="text-muted-foreground">{r.updated}</TableCell>
              <TableCell align="center">
                <Badge variant={STATUS_TONE[r.status]} size="sm">{r.status}</Badge>
              </TableCell>
              <TableCell align="right">
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Row actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {count > 0 && (
        <TableBulkBar label={`${count} ${count === 1 ? 'item' : 'items'} selected`}>
          <TableBulkAction>Export</TableBulkAction>
          <TableBulkAction>Archive</TableBulkAction>
          <TableBulkAction emphasis onClick={() => setSelected({})}>
            Clear
          </TableBulkAction>
        </TableBulkBar>
      )}
      <TableFooter>
        <span>Showing {rows.length} of 312</span>
        <TablePagination page={page} pageCount={3} onPageChange={setPage} />
      </TableFooter>
    </Card>
  )
}

function ListView({ label }: { label: string }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Toolbar label={label} />
      <ul>
        {rows.map((r) => (
          <ListRow
            key={r.name}
            interactive
            className="gap-3.5 px-[22px]"
            leading={
              <Avatar name={r.name} size="lg">
                <AvatarFallback />
              </Avatar>
            }
            heading={<span className="truncate text-[15px] font-bold text-foreground">{r.name}</span>}
            meta={`${r.meta} · ${r.ref}`}
            trailing={
              <>
                <Badge variant={STATUS_TONE[r.status]} size="sm">{r.status}</Badge>
                <ChevronRight className="size-4 text-faint" />
              </>
            }
          />
        ))}
      </ul>
      <TableFooter>
        <span>{rows.length} entries</span>
        <Button variant="link" size="sm">
          View all
        </Button>
      </TableFooter>
    </Card>
  )
}

function CalendarView() {
  const days = Array.from({ length: 35 }, (_, i) => i - 2) // leading blanks
  const events: Record<number, string> = { 3: 'Board', 8: 'Review', 12: 'Leave', 17: 'Audit', 21: 'Town hall', 26: 'Payroll' }
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="grid grid-cols-7 border-b border-border bg-surface-band text-center text-[11px] font-bold tracking-[0.09em] text-foreground uppercase">
        {dow.map((d) => (
          <div key={d} className="py-2.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => (
          <div key={i} className="min-h-24 border-b border-divider p-2">
            {d > 0 && d <= 30 && (
              <>
                <div className="text-caption text-muted-foreground">{d}</div>
                {events[d] && (
                  <div className="mt-1 truncate rounded-[5px] bg-sage-soft px-1.5 py-0.5 text-xs font-bold text-sage-soft-foreground">
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
  const variant = variantFor(app.slug, item.slug)
  return (
    <>
      <PageHeader
        title={item.title}
        description={app.name}
        actions={
          <Badge variant="warning" dot>
            Prototype
          </Badge>
        }
      />
      <div className="p-8">
        {variant === 'dashboard' && <Dashboard />}
        {variant === 'table' && <TableView label={item.title} />}
        {variant === 'list' && <ListView label={item.title} />}
        {variant === 'calendar' && <CalendarView />}
      </div>
    </>
  )
}
