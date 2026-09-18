import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Mail, MessageSquare, Phone, X } from 'lucide-react'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { EmptyState } from '@workspace/ui/components/empty-state'
import { SearchField } from '@workspace/ui/components/search-field'
import { Segmented, SegmentedItem } from '@workspace/ui/components/segmented'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableToolbar } from '@workspace/ui/components/table'
import { useToast } from '@workspace/ui/components/toast'
import { ToneDot } from '@workspace/ui/components/tone-dot'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@workspace/ui/components/tooltip'
import { cn } from '@workspace/ui/lib/utils'
import { PageTitle } from '@/components/layout/page'
import { BRAND } from '@/lib/brand'
import { ascii, awayInfo, isOnBooks, liveUnits, unitChain, unitDescendants, unitPath, unitTone } from '@/features/org/logic'
import { usePeople, useUnits } from '@/features/org/queries'
import type { Person } from '@/features/org/types'
import { useDirectorySearch } from './directory-search'
import { AwayBadge, PersonAvatar, copyText, usePeopleMap } from './people-bits'
import { PersonModal } from './person-modal'

/** The strip every Directory screen opens with: this is a window onto Control Centre's record. */
export function ReadOnlyStrip() {
  return (
    <Alert className="mb-5 flex flex-wrap items-center gap-3 bg-surface-band">
      <AlertDescription className="min-w-[200px] flex-1 text-compact text-body">Read-only. People and admin units are maintained in Control Centre — changes there appear here straight away.</AlertDescription>
      <Button variant="link" size="xs" render={<Link to="/$app" params={{ app: 'control-centre' }} />} className="text-compact">
        Open Control Centre →
      </Button>
    </Alert>
  )
}

/**
 * Everyone in the workspace as a list: scoped from the rail (all, away, a unit, a manager's
 * team), searched, sorted A–Z or grouped by team. A row opens the person's panel.
 */
export function PeoplePage() {
  const units = useUnits()
  const people = usePeople()
  const byId = usePeopleMap()
  const toast = useToast()
  const { scope, sort, q, id, set } = useDirectorySearch()
  const today = useMemo(() => new Date(), [])

  const list = useMemo(() => {
    const needle = ascii(q.trim())
    const inScope = (p: Person) => {
      if (scope.kind === 'away') return !!awayInfo(p, today)?.now
      if (scope.kind === 'group') return p.unitId === scope.id || unitDescendants(units, scope.id).some((u) => u.id === p.unitId)
      if (scope.kind === 'mgr') return p.managerId === scope.id || p.id === scope.id
      return true
    }
    const rows = people.filter((p) => isOnBooks(p) && inScope(p) && (!needle || ascii(`${p.name} ${p.title} ${unitPath(units, p.unitId)} ${p.email} ${p.chat}`).includes(needle)))
    const last = (n: string) => n.split(' ').at(-1) ?? n
    return sort === 'name' ? [...rows].sort((a, b) => last(a.name).localeCompare(last(b.name))) : [...rows].sort((a, b) => (unitPath(units, a.unitId) + a.name).localeCompare(unitPath(units, b.unitId) + b.name))
  }, [people, units, scope, sort, q, today])

  const scopeUnit = scope.kind === 'group' ? units.find((u) => u.id === scope.id) : undefined
  const scopeMgr = scope.kind === 'mgr' ? byId[scope.id] : undefined
  const heading = scopeUnit ? scopeUnit.name : scopeMgr ? `${scopeMgr.name}’s team` : scope.kind === 'away' ? 'Away this week' : `Everyone at ${BRAND.name}`
  const crumb = scopeUnit && scopeUnit.parent ? `Directory · ${unitPath(units, scopeUnit.parent)}` : scopeMgr ? 'Directory · Reporting line' : 'Directory'
  const awayCount = people.filter((p) => isOnBooks(p) && awayInfo(p, today)?.now).length
  const subheading = `${people.filter(isOnBooks).length} people · ${liveUnits(units).length} groups · ${awayCount} away this week`
  const filterPill = scopeUnit ? unitChain(units, scopeUnit.id).slice(-2).map((u) => u.name).join(' · ') : scopeMgr ? `Reports to ${scopeMgr.name}` : ''

  function copy(text: string, label: string) {
    copyText(text)
    toast(`${label} copied · ${text}`)
  }

  // by team, each group of rows gets a sticky header; A–Z runs flat
  let lastUnit: string | null | undefined
  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ReadOnlyStrip />
        <PageTitle overline={crumb} title={heading} meta={<span>{subheading}</span>} className="mb-5" />

        <Card className="gap-0 overflow-clip py-0">
          <TableToolbar className="px-5">
            <SearchField size="sm" placeholder="Search people, roles, teams" value={q} onChange={(e) => set({ q: e.target.value })} className="min-w-[220px] max-w-xs" />
            <span className="text-compact font-bold text-muted-foreground">{list.length === 1 ? '1 person' : `${list.length} people`}</span>
            {filterPill && (
              <Badge variant="filter-active" render={<button type="button" onClick={() => set({ scope: { kind: 'all' } })} aria-label={`Clear ${filterPill}`} />} className="gap-2">
                {filterPill}
                <X className="size-3 opacity-70" />
              </Badge>
            )}
            <span className="flex-1" />
            <span className="text-caption text-faint">Sort</span>
            <Segmented>
              <SegmentedItem active={sort === 'name'} onClick={() => set({ sort: 'name' })}>
                A–Z
              </SegmentedItem>
              <SegmentedItem active={sort === 'team'} onClick={() => set({ sort: 'team' })}>
                By team
              </SegmentedItem>
            </Segmented>
          </TableToolbar>

          {list.length > 0 ? (
            <TooltipProvider delay={300}>
              <Table>
                <TableHeader>
                  <TableRow className="h-auto hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead align="right">Availability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((p) => {
                    const tone = unitTone(units, p.unitId)
                    const groupFirst = sort === 'team' && p.unitId !== lastUnit
                    if (sort === 'team') lastUnit = p.unitId
                    const groupCount = groupFirst ? list.filter((x) => x.unitId === p.unitId).length : 0
                    const mgr = byId[p.managerId ?? '']
                    return (
                      <TableRowGroup key={p.id} groupFirst={groupFirst} groupLabel={unitChain(units, p.unitId).slice(-2).map((u) => u.name).join(' · ') || 'Company'} groupCount={groupCount} tone={tone}>
                        <TableRow className="group/row cursor-pointer" onClick={() => set({ id: p.id })}>
                          <TableCell className="max-w-[320px]">
                            <span className="flex items-center gap-3">
                              <PersonAvatar person={p} units={units} className="size-[34px]" />
                              <span className="min-w-0">
                                <span className="block truncate text-ui font-bold text-foreground">{p.name}</span>
                                {mgr && <span className="block truncate text-fine text-faint">Reports to {mgr.name}</span>}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-body">{p.title}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">{unitChain(units, p.unitId).slice(-2).map((u) => u.name).join(' · ') || 'Company'}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1">
                              <Button variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); copy(p.email, 'Email') }} className="max-w-[240px] font-normal text-muted-foreground" title="Copy email address">
                                <Mail className="size-3.5 shrink-0 text-faint" strokeWidth={1.6} />
                                <span className="truncate">{p.email}</span>
                              </Button>
                              <span className="flex items-center gap-0.5 opacity-0 transition-opacity duration-instant group-hover/row:opacity-100 focus-within:opacity-100">
                                <Tooltip>
                                  <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); copy(p.phone, 'Phone') }} />} aria-label="Copy phone" className="text-faint">
                                    <Phone strokeWidth={1.6} />
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">Copy phone · {p.phone}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); copy(p.chat, 'Chat handle') }} />} aria-label="Copy chat handle" className="text-faint">
                                    <MessageSquare strokeWidth={1.6} />
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">Copy chat handle · {p.chat}</TooltipContent>
                                </Tooltip>
                              </span>
                            </span>
                          </TableCell>
                          <TableCell align="right">
                            <AwayBadge person={p} today={today} />
                          </TableCell>
                        </TableRow>
                      </TableRowGroup>
                    )
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          ) : (
            <EmptyState title="No one matches that" description="Try a name, a role like “designer”, or a team name." action={q || scope.kind !== 'all' ? <Button variant="outline" size="sm" onClick={() => set({ q: '', scope: { kind: 'all' } })}>Show everyone</Button> : undefined} />
          )}
        </Card>
      </div>
      <PersonModal id={id} onClose={() => set({ id: undefined })} onOpen={(pid) => set({ id: pid })} />
    </div>
  )
}

/** A row, preceded by its team's sticky header when a new team starts. */
function TableRowGroup({ groupFirst, groupLabel, groupCount, tone, children }: { groupFirst: boolean; groupLabel: string; groupCount: number; tone: Parameters<typeof ToneDot>[0]['tone']; children: React.ReactNode }) {
  return (
    <>
      {groupFirst && (
        <TableRow className="h-auto hover:bg-transparent">
          <TableCell colSpan={5} className={cn('sticky top-0 z-[2] border-b-0 bg-surface-band py-2 text-fine font-bold tracking-[0.04em] text-body')}>
            <span className="flex items-center gap-2.5">
              <ToneDot tone={tone} shape="square" size={7} />
              <span className="flex-1">{groupLabel}</span>
              <span className="font-normal text-faint">{groupCount === 1 ? '1 person' : `${groupCount} people`}</span>
            </span>
          </TableCell>
        </TableRow>
      )}
      {children}
    </>
  )
}
