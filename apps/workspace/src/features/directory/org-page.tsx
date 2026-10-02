import { useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Card } from '@workspace/ui/components/card'
import { PageTitle } from '@workspace/ui/components/page'
import { isOnBooks } from '@workspace/org/logic'
import { usePeople, useUnits } from '@workspace/org/queries'
import { OrgCanvas, OrgChartToolbar, buildOrgTree, useOrgChart } from '@workspace/org/org-chart'
import { ReadOnlyStrip } from './people-page'
import { PersonModal } from './person-modal'

/** The org chart screen: the canvas plus its toolbar (find, expand/collapse, zoom) and the person panel. */
export function OrgPage() {
  const units = useUnits()
  const people = usePeople()
  const navigate = useNavigate()
  const search = useSearch({ from: '/_app/$app/$section' })
  const today = useMemo(() => new Date(), [])
  const tree = useMemo(() => buildOrgTree(units, people, today), [units, people, today])
  const [panel, setPanel] = useState<string | undefined>()

  // a deep link (?id=) reveals that person: open their ancestors and scroll to the card
  const focusNode = search.id ? `p:${search.id}` : null
  const chart = useOrgChart(tree, units, focusNode)
  const hits = useMemo(() => new Set(chart.matches.length ? chart.matches : focusNode ? [focusNode] : []), [chart.matches, focusNode])
  const shown = Object.keys(chart.openSet).length

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ReadOnlyStrip />
        <PageTitle overline="Directory · Structure" title="Org chart" meta={<span>Expand a group to see the groups and people inside it.</span>} className="mb-5" />
        <Card className="gap-0 overflow-clip py-0">
          <OrgChartToolbar tree={tree} chart={chart} summary={`${people.filter(isOnBooks).length} people · ${shown} ${shown === 1 ? 'card open' : 'cards open'}`} />
          <OrgCanvas tree={tree} units={units} openSet={chart.openSet} setOpen={chart.setOpenSet} zoom={chart.zoom} hits={hits} focus={chart.current ?? focusNode} onOpenPerson={setPanel} onSeePeople={(uid) => void navigate({ to: '/$app', params: { app: 'directory' }, search: { scope: `group:${uid}` } })} />
        </Card>
      </div>
      <PersonModal id={panel} onClose={() => setPanel(undefined)} onOpen={setPanel} />
    </div>
  )
}
