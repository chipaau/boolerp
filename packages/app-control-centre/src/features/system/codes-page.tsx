import { useState } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { useToast } from '@workspace/ui/components/toast'
import { useNumbering } from '@workspace/org/queries'
import type { NumberingRule } from '@workspace/org/types'
import { CodePatternDialog } from './code-pattern-dialog'
import { ControlTitle, RuleStrip, useIsAdmin } from '../shared'

/** The apps a numbering pattern or notification can come from, in rail order. */
export const APP_LIST = ['Control Centre', 'Inventory', 'Calendar', 'Scan']

/** Card header row: "All apps" plus one pill per app, and a count on the right. */
export function AppTabs({ value, onChange, count }: { value: string; onChange: (app: string) => void; count: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-[7px] border-b border-divider px-5 py-[13px]">
      {['all', ...APP_LIST].map((a) => (
        <Badge key={a} variant={value === a ? 'filter-active' : 'filter'} render={<button type="button" onClick={() => onChange(a)} />}>
          {a === 'all' ? 'All apps' : a}
        </Badge>
      ))}
      <span className="min-w-2 flex-1" />
      <span className="text-compact text-faint">{count}</span>
    </div>
  )
}

/** The shape of every reference the apps generate; Admins change a pattern for new records only. */
export function CodesPage() {
  const codes = useNumbering()
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const [app, setApp] = useState('all')
  const [editing, setEditing] = useState<NumberingRule | null>(null)
  const list = codes.filter((k) => app === 'all' || k.app === app)
  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle overline="System" title="Codes & numbering" description="The shape of every reference the apps generate. Change a pattern and it applies to new records only — anything already issued keeps the code it was given." />
        <RuleStrip>Patterns apply to new records only — anything already issued keeps the code it was given</RuleStrip>
        <Card className="gap-0 overflow-clip py-0">
          <AppTabs value={app} onChange={setApp} count={`${list.length} of ${codes.length} patterns`} />
          {list.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-3.5 border-b border-divider px-5 py-[15px] last:border-b-0">
              <span className="min-w-0 flex-[1_1_200px]">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{k.label}</span>
                  <Badge variant="neutral" size="sm">{k.app}</Badge>
                </span>
                <span className="mt-[3px] block text-caption leading-[1.45] text-faint">{k.note}</span>
              </span>
              <span className="shrink-0 rounded-lg bg-surface-band px-[11px] py-1.5 font-mono text-compact text-foreground">{k.pattern}</span>
              <span className="shrink-0 text-compact text-body">next {k.next}</span>
              <Button variant="outline" size="sm" onClick={() => (isAdmin ? setEditing(k) : toast('Only Admins change numbering', { ok: false }))}>
                Edit
              </Button>
            </div>
          ))}
        </Card>
      </div>
      <CodePatternDialog rule={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
