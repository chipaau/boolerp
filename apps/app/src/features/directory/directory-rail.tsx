import { useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ChevronDown, Network, Plane, Users } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { useSidebar } from '@workspace/ui/components/sidebar'
import { ToneDot } from '@workspace/ui/components/tone-dot'
import { Tooltip, TooltipContent, TooltipTrigger } from '@workspace/ui/components/tooltip'
import { cn } from '@workspace/ui/lib/utils'
import type { AppDef } from '@/lib/apps'
import { awayInfo, isOnBooks, unitKids, unitMembers, unitTone } from '@/features/org/logic'
import { usePeople, useUnits } from '@/features/org/queries'
import type { Unit } from '@/features/org/types'
import { useDirectorySearch } from './directory-search'

const rowClass = (on: boolean) =>
  cn('flex w-full items-center gap-2 rounded-lg py-[7px] pr-2.5 pl-2.5 text-left text-ui-sm outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring', on ? 'bg-sidebar-accent font-bold text-foreground' : 'text-body hover:bg-sidebar-hover hover:text-foreground')

/**
 * The Directory's rail: everyone, who is away this week, the org chart, then the unit tree (any
 * depth, coloured, with head-counts). Clicking a unit scopes the list to it; the chevron opens it.
 */
export function DirectoryRail(_: { app: AppDef }) {
  const units = useUnits()
  const people = usePeople()
  const { scope, set } = useDirectorySearch()
  const { pathname } = useLocation()
  const collapsed = useSidebar().state === 'collapsed'
  const [open, setOpen] = useState<Record<string, boolean>>({ eng: true })
  const today = new Date()
  const onOrg = pathname.endsWith('/org')
  const onList = !onOrg
  const total = people.filter(isOnBooks).length
  const away = people.filter((p) => isOnBooks(p) && awayInfo(p, today)?.now).length

  if (collapsed) {
    const icon = (label: string, on: boolean, node: React.ReactNode, onClick?: () => void, to?: string) => (
      <Tooltip key={label}>
        <TooltipTrigger render={to ? <Button variant={on ? 'secondary' : 'ghost'} size="icon-sm" render={<Link to="/$app/$section" params={{ app: 'directory', section: 'org' }} />} /> : <Button variant={on ? 'secondary' : 'ghost'} size="icon-sm" onClick={onClick} />} aria-label={label} className="text-body">
          {node}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    )
    return (
      <div className="flex flex-col items-center gap-1.5">
        {icon('All people', onList && scope.kind === 'all', <Users strokeWidth={1.75} />, () => set({ scope: { kind: 'all' } }))}
        {icon(`Away this week · ${away}`, onList && scope.kind === 'away', <Plane strokeWidth={1.75} />, () => set({ scope: { kind: 'away' } }))}
        {icon('Org chart', onOrg, <Network strokeWidth={1.75} />, undefined, 'org')}
      </div>
    )
  }

  function walk(u: Unit, depth: number): React.ReactNode {
    const kids = unitKids(units, u.id)
    const isOpen = !!open[u.id]
    const on = onList && scope.kind === 'group' && scope.id === u.id
    const tone = unitTone(units, u.id)
    return (
      <li key={u.id}>
        <div className={cn(rowClass(on), 'gap-1.5')} style={{ paddingLeft: 10 + depth * 14 }}>
          <button
            type="button"
            aria-label={isOpen ? `Collapse ${u.name}` : `Expand ${u.name}`}
            onClick={() => setOpen((o) => ({ ...o, [u.id]: !isOpen }))}
            className={cn('grid size-4 shrink-0 place-items-center rounded text-faint transition-transform duration-instant', !isOpen && '-rotate-90', !kids.length && 'invisible')}
          >
            <ChevronDown className="size-3" strokeWidth={1.8} />
          </button>
          <ToneDot tone={tone} shape={depth ? 'round' : 'square'} size={depth ? 5 : 7} className={cn(depth > 0 && !on && 'opacity-55')} />
          <button type="button" onClick={() => set({ scope: { kind: 'group', id: u.id }, id: undefined })} className={cn('min-w-0 flex-1 truncate text-left outline-none', depth === 0 ? 'font-bold' : 'text-compact')}>
            {u.name}
          </button>
          <span className="text-fine tabular-nums text-faint">{unitMembers(people, units, u.id, true).length}</span>
        </div>
        {isOpen && kids.length > 0 && <ul className="flex flex-col gap-px">{kids.map((k) => walk(k, depth + 1))}</ul>}
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-px">
        <button type="button" onClick={() => set({ scope: { kind: 'all' }, id: undefined })} className={rowClass(onList && scope.kind === 'all')}>
          <span className="flex-1">All people</span>
          <span className="text-fine tabular-nums text-faint">{total}</span>
        </button>
        <button type="button" onClick={() => set({ scope: { kind: 'away' }, id: undefined })} className={rowClass(onList && scope.kind === 'away')}>
          <span className="flex-1">Away this week</span>
          {away > 0 && (
            <Badge variant="warning" size="sm">
              {away}
            </Badge>
          )}
        </button>
        <Link to="/$app/$section" params={{ app: 'directory', section: 'org' }} className={rowClass(onOrg)}>
          <span className="flex-1">Org chart</span>
          <Network className="size-3.5 text-faint" strokeWidth={1.6} />
        </Link>
      </div>
      <div className="border-t border-sidebar-border pt-4">
        <div className="mb-2 px-2.5 text-overline text-faint">Groups</div>
        <ul className="flex flex-col gap-px">{unitKids(units, null).map((u) => walk(u, 0))}</ul>
      </div>
    </div>
  )
}
