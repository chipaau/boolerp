import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { SearchField } from '@workspace/ui/components/search-field'
import { Segmented, SegmentedItem } from '@workspace/ui/components/segmented'
import { TableToolbar } from '@workspace/ui/components/table'
import { PageTitle } from '@/components/layout/page'
import { isOnBooks } from '@/features/org/logic'
import { usePeople, useUnits } from '@/features/org/queries'
import { OrgCanvas, ancestorsOf, buildOrgTree, matchNodes } from './org-chart'
import { ReadOnlyStrip } from './people-page'
import { PersonPanel } from './person-panel'

const ZOOMS = [0.4, 0.55, 0.7, 0.85, 1, 1.2]

/** The org chart screen: the canvas plus its toolbar (find, expand/collapse, zoom) and the person panel. */
export function OrgPage() {
  const units = useUnits()
  const people = usePeople()
  const navigate = useNavigate()
  const search = useSearch({ from: '/_app/$app/$section' })
  const today = useMemo(() => new Date(), [])
  const tree = useMemo(() => buildOrgTree(units, people, today), [units, people, today])
  const [openSet, setOpenSet] = useState<Record<string, boolean>>({ co: true })
  const [zoom, setZoom] = useState(0.85)
  const [q, setQ] = useState('')
  const [matchIx, setMatchIx] = useState(0)
  const [panel, setPanel] = useState<string | undefined>()

  // a deep link (?id=) reveals that person: open their ancestors and scroll to the card
  const focusNode = search.id ? `p:${search.id}` : null
  useEffect(() => {
    if (!focusNode) return
    setOpenSet((o) => ({ ...o, co: true, ...Object.fromEntries(ancestorsOf(tree, focusNode).map((a) => [a, true])) }))
  }, [focusNode, tree])

  const matches = useMemo(() => matchNodes(tree, units, q), [tree, units, q])
  const effectiveOpen = useMemo(() => {
    const o = { ...openSet }
    matches.forEach((id) => ancestorsOf(tree, id).forEach((a) => { o[a] = true }))
    return o
  }, [openSet, matches, tree])
  const hits = useMemo(() => new Set(matches.length ? matches : focusNode ? [focusNode] : []), [matches, focusNode])
  const focus = matches.length ? matches[Math.min(matchIx, matches.length - 1)] : focusNode

  const shown = Object.keys(effectiveOpen).length
  const step = (dir: 1 | -1) => setZoom((z) => { const i = ZOOMS.indexOf(z); return ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 3 : i) + dir))] })

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ReadOnlyStrip />
        <PageTitle overline="Directory · Structure" title="Org chart" meta={<span>Expand a group to see the groups and people inside it.</span>} className="mb-5" />
        <Card className="gap-0 overflow-clip py-0">
          <TableToolbar className="px-5">
            <SearchField size="sm" placeholder="Find in chart" value={q} onChange={(e) => { setQ(e.target.value); setMatchIx(0) }} className="min-w-[200px] max-w-xs" />
            <span className="text-compact font-bold text-muted-foreground">
              {people.filter(isOnBooks).length} people · {shown} {shown === 1 ? 'card open' : 'cards open'}
            </span>
            {q.trim() && (
              <Badge variant={matches.length ? 'warning' : 'neutral'} size="sm" className="gap-1.5 pr-1">
                {matches.length ? `${Math.min(matchIx, matches.length - 1) + 1} of ${matches.length} matching` : 'No match'}
                <Button variant="ghost" size="icon-xs" aria-label="Previous match" disabled={!matches.length} onClick={() => setMatchIx((i) => (i - 1 + matches.length) % matches.length)} className="size-5 text-current">
                  <ChevronUp />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label="Next match" disabled={!matches.length} onClick={() => setMatchIx((i) => (i + 1) % matches.length)} className="size-5 text-current">
                  <ChevronDown />
                </Button>
              </Badge>
            )}
            <span className="flex-1" />
            <span className="text-caption text-faint">Depth</span>
            <Badge variant="filter" render={<button type="button" onClick={() => { setOpenSet({ co: true }); setZoom(0.85) }} />}>
              Collapse all
            </Badge>
            <Badge variant="filter" render={<button type="button" onClick={() => { setOpenSet(Object.fromEntries(tree.nodes.filter((n) => n.children.length).map((n) => [n.id, true]))); setZoom(0.55) }} />}>
              Expand all
            </Badge>
            <Segmented>
              <SegmentedItem aria-label="Zoom out" className="w-[30px] px-0" onClick={() => step(-1)}>
                <Minus className="size-3.5" strokeWidth={1.8} />
              </SegmentedItem>
              <SegmentedItem className="w-12 px-0 tabular-nums" onClick={() => setZoom(0.85)}>
                {Math.round(zoom * 100)}%
              </SegmentedItem>
              <SegmentedItem aria-label="Zoom in" className="w-[30px] px-0" onClick={() => step(1)}>
                <Plus className="size-3.5" strokeWidth={1.8} />
              </SegmentedItem>
            </Segmented>
          </TableToolbar>
          <OrgCanvas tree={tree} units={units} openSet={effectiveOpen} setOpen={setOpenSet} zoom={zoom} hits={hits} focus={focus} onOpenPerson={setPanel} onSeePeople={(uid) => void navigate({ to: '/$app', params: { app: 'directory' }, search: { scope: `group:${uid}` } })} />
        </Card>
      </div>
      <PersonPanel id={panel} onClose={() => setPanel(undefined)} onOpen={setPanel} />
    </div>
  )
}
