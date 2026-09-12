import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, MoreHorizontal } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@workspace/ui/components/dropdown-menu'
import { ToneDot } from '@workspace/ui/components/tone-dot'
import { cn } from '@workspace/ui/lib/utils'
import { BRAND } from '@/lib/brand'
import { ascii, awayInfo, directReports, isOnBooks, unitKids, unitLead, unitMembers, unitPath, unitTone } from '@/features/org/logic'
import type { Person, Tone, Unit } from '@/features/org/types'
import { PersonAvatar, TONE_FALLBACK, copyText } from './people-bits'

export const CW = 254, CH = 118, GAPX = 28, GAPY = 70
export type OrgNode = { id: string; kind: 'co' | 'unit' | 'person'; label: string; sub: string; initials: string; person?: Person; unit?: Unit; countLabel: string; meta: string; away: string; tone: Tone; children: OrgNode[]; parentId?: string }

/** Company → units (any depth) → people. Built once per data change; layout is a separate, cheap pass. */
export function buildOrgTree(units: Unit[], people: Person[], today: Date) {
  const nodes: OrgNode[] = []
  const chief = people.find((p) => isOnBooks(p) && !p.managerId)
  const live = people.filter(isOnBooks)
  const root: OrgNode = {
    id: 'co', kind: 'co', person: chief, label: chief?.name ?? BRAND.name, sub: chief ? `${chief.title} · ${BRAND.name}` : 'Whole company',
    initials: chief ? initials(chief.name) : BRAND.name.slice(0, 1), countLabel: `${live.length} people`, meta: `${unitKids(units, null).length} top-level groups`, away: '', tone: 'warning', children: [],
  }
  nodes.push(root)
  const personNode = (p: Person, tone: Tone): OrgNode => {
    const n = directReports(people, p.id).length
    const a = awayInfo(p, today)
    const node: OrgNode = { id: `p:${p.id}`, kind: 'person', person: p, label: p.name, sub: p.title, initials: initials(p.name), countLabel: n ? `${n} ${n === 1 ? 'report' : 'reports'}` : 'Individual', meta: '', away: a?.now ? a.short : '', tone, children: [] }
    nodes.push(node)
    return node
  }
  const walk = (u: Unit, parent: OrgNode) => {
    const deep = unitMembers(people, units, u.id, true), direct = unitMembers(people, units, u.id, false).filter((p) => p.id !== chief?.id)
    const lead = unitLead(units, people, u.id)
    const kids = unitKids(units, u.id)
    const tone = unitTone(units, u.id)
    const node: OrgNode = {
      id: `g:${u.id}`, kind: 'unit', unit: u, label: u.name, sub: lead ? `Led by ${lead.name} · ${lead.title}` : 'No lead assigned', initials: u.name.slice(0, 2).toUpperCase(),
      countLabel: `${deep.length} ${deep.length === 1 ? 'person' : 'people'}`, meta: kids.length ? `${kids.length} ${kids.length === 1 ? 'subgroup' : 'subgroups'}` : u.parent ? unitPath(units, u.parent).split(' · ').at(-1) ?? '' : '', away: '', tone, children: [],
    }
    parent.children.push(node)
    nodes.push(node)
    kids.forEach((k) => walk(k, node))
    ;[...direct].sort((a, b) => directReports(people, b.id).length - directReports(people, a.id).length || a.name.localeCompare(b.name)).forEach((p) => node.children.push(personNode(p, tone)))
  }
  unitKids(units, null).forEach((u) => walk(u, root))
  nodes.forEach((n) => n.children.forEach((c) => { c.parentId = n.id }))
  return { root, nodes, byId: Object.fromEntries(nodes.map((n) => [n.id, n])) as Partial<Record<string, OrgNode>> }
}
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

/** Tidy-tree placement: leaves take a column each, an open parent centres over its children. */
export function placeNodes(root: OrgNode, openSet: Record<string, boolean>) {
  const placed: Partial<Record<string, { x: number; y: number; open: boolean }>> = {}
  let cursor = 0, maxDepth = 0
  const place = (n: OrgNode, depth: number): number => {
    const open = !!openSet[n.id] && n.children.length > 0
    let x: number
    if (open) {
      const xs = n.children.map((c) => place(c, depth + 1))
      x = (xs[0] + xs[xs.length - 1]) / 2
    } else {
      x = cursor
      cursor += CW + GAPX
    }
    maxDepth = Math.max(maxDepth, depth)
    placed[n.id] = { x, y: depth * (CH + GAPY), open }
    return x
  }
  place(root, 0)
  return { placed, width: Math.max(cursor - GAPX, CW) + 8, height: maxDepth * (CH + GAPY) + CH + 30 }
}

/**
 * The chart itself: a zoomable canvas of cards joined by curved connectors. `openSet` is owned
 * by the page (so its toolbar can expand and collapse everything); `hits` are highlighted and the
 * canvas scrolls to `focus` when it changes.
 */
export function OrgCanvas({
  tree, openSet, setOpen, zoom, hits, focus, onOpenPerson, onSeePeople, units,
}: {
  tree: ReturnType<typeof buildOrgTree>
  openSet: Record<string, boolean>
  setOpen: (next: Record<string, boolean>) => void
  zoom: number
  hits: Set<string>
  focus: string | null
  onOpenPerson: (id: string) => void
  onSeePeople: (unitId: string) => void
  units: Unit[]
}) {
  const view = useRef<HTMLDivElement>(null)
  const layout = useMemo(() => placeNodes(tree.root, openSet), [tree, openSet])
  const navigate = useNavigate()

  const flip = (id: string) => setOpen({ ...openSet, [id]: !openSet[id] })
  useEffect(() => {
    const el = view.current, pos = focus ? layout.placed[focus] : undefined
    if (!el || !pos) return
    el.scrollTo({ left: Math.max(0, (pos.x + CW / 2) * zoom - el.clientWidth / 2), top: Math.max(0, (pos.y + CH / 2) * zoom - el.clientHeight / 2), behavior: 'smooth' })
  }, [focus, layout, zoom])
  useEffect(() => {
    // first paint: centre on the company card
    const el = view.current, co = layout.placed.co
    if (!el || focus || !co) return
    el.scrollLeft = Math.max(0, (co.x + CW / 2) * zoom - el.clientWidth / 2)
  }, [])

  const anchor = (n: OrgNode) => {
    const own = layout.placed[n.id]
    if (own) return { pos: own, shown: true }
    let cur = n.parentId
    while (cur) {
      const p = layout.placed[cur]
      if (p) return { pos: p, shown: false }
      cur = tree.byId[cur]?.parentId
    }
    return { pos: { x: 0, y: 0, open: false }, shown: false }
  }

  return (
    <div ref={view} className="relative h-[min(72vh,720px)] overflow-auto bg-surface-band bg-[radial-gradient(var(--divider)_1px,transparent_1px)] p-[26px] pb-10 [background-size:18px_18px]">
      <div className="relative transition-[width,height] duration-considered" style={{ width: Math.round(layout.width * zoom), height: Math.round(layout.height * zoom) }}>
        <div className="absolute top-0 left-0 origin-top-left transition-transform duration-considered" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
          <svg width={layout.width} height={layout.height} className="pointer-events-none absolute top-0 left-0 overflow-visible">
            {tree.nodes.map((n) => {
              if (!n.parentId) return null
              const par = layout.placed[n.parentId], ch = layout.placed[n.id]
              const live = !!(par && ch && par.open)
              if (!live) return null
              const px = par.x + CW / 2, py = par.y + CH + 12, cx = ch.x + CW / 2, cy = ch.y - 6
              const mid = py + (cy - py) * 0.55
              const col = `var(--color-tone-${n.tone})`
              return (
                <g key={n.id} style={{ color: col }}>
                  <path d={`M${px} ${py} C ${px} ${mid}, ${cx} ${cy - (cy - py) * 0.45}, ${cx} ${cy}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="5 6" strokeLinecap="round" opacity={0.45} />
                  <circle cx={px} cy={py} r={3.2} fill="currentColor" opacity={0.5} />
                  <circle cx={cx} cy={cy} r={3.2} fill="currentColor" opacity={0.5} />
                </g>
              )
            })}
          </svg>
          {tree.nodes.map((n) => {
            const at = anchor(n)
            const open = !!openSet[n.id], nKids = n.children.length, hit = hits.has(n.id)
            const isRoot = n.kind === 'co', isPerson = n.kind === 'person'
            return (
              <div
                key={n.id}
                className={cn('absolute top-0 left-0 transition-[transform,opacity] duration-considered', !at.shown && 'pointer-events-none opacity-0')}
                style={{ width: CW, transform: `translate(${at.pos.x}px, ${at.pos.y}px)` }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => (isPerson && n.person ? onOpenPerson(n.person.id) : nKids ? flip(n.id) : undefined)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); isPerson && n.person ? onOpenPerson(n.person.id) : flip(n.id) } }}
                  className={cn('relative cursor-pointer rounded-[14px] px-3.5 py-[13px] shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring', isRoot ? 'bg-tone-warning-soft' : 'bg-card', hit && 'ring-2 ring-brand-soft')}
                  style={{ width: CW, height: CH }}
                >
                  <div className="flex items-start gap-[11px]">
                    {isPerson ? (
                      <PersonAvatar person={n.person} units={units} className="size-[34px]" />
                    ) : (
                      <span className={cn('grid size-[34px] shrink-0 place-items-center text-micro font-bold', isRoot ? 'rounded-full bg-card/85 text-body' : cn('rounded-[10px]', TONE_FALLBACK[n.tone]))}>{n.initials}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-[7px]">
                        {isPerson && <ToneDot tone={n.tone} shape="round" size={8} />}
                        <span className="block min-w-0 truncate text-ui font-bold tracking-[-0.008em] text-foreground">{n.label}</span>
                      </span>
                      <span className="mt-[3px] line-clamp-2 block text-compact leading-[1.32] text-pretty text-muted-foreground">{n.sub}</span>
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" onClick={(e) => e.stopPropagation()} />} aria-label="Actions" className="-mt-0.5 -mr-1 text-faint">
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 p-1.5">
                        {isPerson && n.person && (
                          <>
                            <DropdownMenuItem onClick={() => onOpenPerson(n.person!.id)}>Open profile</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyText(n.person!.email)}>Copy email</DropdownMenuItem>
                          </>
                        )}
                        {n.kind === 'unit' && n.unit && (
                          <>
                            <DropdownMenuItem onClick={() => onSeePeople(n.unit!.id)}>See people in list</DropdownMenuItem>
                            <DropdownMenuItem disabled={!nKids} onClick={() => flip(n.id)}>{open ? 'Collapse group' : 'Expand group'}</DropdownMenuItem>
                          </>
                        )}
                        {isRoot && (
                          <>
                            <DropdownMenuItem disabled={!n.person} onClick={() => n.person && onOpenPerson(n.person.id)}>Open profile</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => flip(n.id)}>{open ? 'Collapse everything' : 'Show top-level groups'}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void navigate({ to: '/$app', params: { app: 'directory' }, search: {} })}>See everyone in list</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-[13px] flex min-w-0 items-center gap-[7px]">
                    <Badge variant={isRoot ? 'neutral' : n.tone} size="sm" className={cn(isRoot && 'bg-card/70')}>
                      {n.countLabel}
                    </Badge>
                    {n.meta && <span className="min-w-0 truncate text-caption text-faint">{n.meta}</span>}
                    {n.away && (
                      <Badge variant="warning" size="sm" className="ms-auto">
                        {n.away}
                      </Badge>
                    )}
                  </div>
                </div>
                {nKids > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); flip(n.id) }}
                    aria-label={open ? 'Collapse' : 'Expand'}
                    className="absolute left-1/2 z-[3] flex h-[26px] -translate-x-1/2 items-center gap-1.5 rounded-full bg-card px-[11px] text-fine font-bold text-muted-foreground shadow-[0_1px_2px_rgba(64,44,20,0.14),inset_0_0_0_1px_var(--divider)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ top: CH - 13 }}
                  >
                    {open ? nKids : `+${nKids}`}
                    <ChevronDown className={cn('size-2.5 transition-transform duration-considered', open && 'rotate-180')} strokeWidth={1.8} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** The nodes a search matches: label, subtitle and, for units and people, the unit path. */
export function matchNodes(tree: ReturnType<typeof buildOrgTree>, units: Unit[], q: string) {
  const needle = ascii(q.trim())
  if (!needle) return []
  return tree.nodes.filter((n) => ascii(`${n.label} ${n.sub} ${n.unit ? unitPath(units, n.unit.id) : n.person ? unitPath(units, n.person.unitId) : ''}`).includes(needle)).map((n) => n.id)
}
export function ancestorsOf(tree: ReturnType<typeof buildOrgTree>, id: string) {
  const out: string[] = []
  let cur = tree.byId[id]?.parentId
  while (cur) { out.push(cur); cur = tree.byId[cur]?.parentId }
  return out
}
