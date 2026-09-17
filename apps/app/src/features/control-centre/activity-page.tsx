import { useState } from 'react'
import { Download } from 'lucide-react'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { NativeSelect } from '@workspace/ui/components/native-select'
import { SearchField } from '@workspace/ui/components/search-field'
import { useToast } from '@workspace/ui/components/toast'
import { downloadCsv } from '@/lib/csv'
import { PersonAvatar } from '@/features/directory/people-bits'
import { useAudit, useAuditLog, usePeople, useUnits } from '@/features/org/queries'
import type { AuditEntry } from '@/features/org/types'
import { ControlTitle } from './control-bits'

const APPS = ['Control Centre', 'Inventory', 'Calendar', 'Scan']
const DAYS = [
  { id: 'all', label: 'All time' },
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
]
const unique = (list: string[]) => list.filter((v, i, all) => all.indexOf(v) === i)
const selectClass = 'w-auto'

/**
 * Everything that happened across the suite, newest first, grouped by day. Read-only; the export
 * downloads the whole log as CSV and records that it did.
 */
export function ActivityPage() {
  const audit = useAudit(), people = usePeople(), units = useUnits()
  const log = useAuditLog()
  const toast = useToast()
  const [scope, setScope] = useState('all')
  const [q, setQ] = useState('')
  const [who, setWho] = useState('all')
  const [days, setDays] = useState('all')
  const [app, setApp] = useState('all')
  const [significant, setSignificant] = useState(false)

  const aq = q.trim().toLowerCase()
  const shown = audit.filter(
    (a) =>
      (!aq || `${a.text} ${a.who} ${a.scope} ${a.app}`.toLowerCase().includes(aq)) &&
      (scope === 'all' || a.scope === scope) &&
      (app === 'all' || a.app === app) &&
      (who === 'all' || a.who === who) &&
      (days === 'all' || a.days <= Number(days)) &&
      (!significant || a.sev === 'high')
  )
  const filtered = scope !== 'all' || app !== 'all' || who !== 'all' || days !== 'all' || significant || !!aq
  // the log reads as a diary, so entries sit under the day they happened
  const groups = shown.reduce<{ date: string; rows: AuditEntry[] }[]>((acc, a) => {
    const date = a.days === 0 ? 'Today' : a.when.split(',')[0].trim()
    let g = acc.find((x) => x.date === date)
    if (!g) acc.push((g = { date, rows: [] }))
    g.rows.push(a)
    return acc
  }, [])

  function clear() {
    setScope('all'); setApp('all'); setWho('all'); setDays('all'); setSignificant(false); setQ('')
  }
  function exportLog() {
    const name = 'bool-activity-log.csv'
    const rows = [['When', 'Area', 'Change', 'By'], ...audit.map((a) => [a.when, a.scope, a.text, a.who])]
    downloadCsv(name, rows)
    log('Export', `${name} downloaded`)
    toast(`${name} downloaded`)
  }

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <ControlTitle
          overline="System"
          title="Activity log"
          description="Everything that happened across the suite, newest first — who did it and what changed. Nothing here can be edited."
          actions={
            <Button variant="outline" onClick={exportLog}>
              <Download strokeWidth={1.8} />
              Export CSV
            </Button>
          }
        />

        <div className="mt-[18px] mb-3 flex flex-wrap gap-[7px]">
          {['all', ...unique(audit.map((a) => a.scope))].map((s) => (
            <Badge key={s} variant={scope === s ? 'filter-active' : 'filter'} render={<button type="button" aria-pressed={scope === s} onClick={() => setScope(s)} />}>
              {s === 'all' ? 'Everything' : s}
            </Badge>
          ))}
        </div>

        <Card className="gap-0 overflow-clip py-0">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-divider px-5 py-[13px]">
            <SearchField size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search what changed, or who changed it" className="min-w-[160px] flex-[2_1_220px]" />
            <NativeSelect value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who" className={selectClass}>
              <option value="all">Anyone</option>
              {unique(audit.map((a) => a.who)).map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={days} onChange={(e) => setDays(e.target.value)} aria-label="When" className={selectClass}>
              {DAYS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={app} onChange={(e) => setApp(e.target.value)} aria-label="App" className={selectClass}>
              <option value="all">All apps</option>
              {unique([...APPS, ...audit.map((a) => a.app)]).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </NativeSelect>
            <Badge variant={significant ? 'warning' : 'outline'} render={<button type="button" aria-pressed={significant} onClick={() => setSignificant((v) => !v)} />}>
              {significant ? 'Significant only' : 'All severities'}
            </Badge>
            {filtered && (
              <Button variant="link" size="xs" onClick={clear}>
                Clear
              </Button>
            )}
            <span className="min-w-2 flex-1" />
            <span className="text-compact text-faint">
              {shown.length} of {audit.length} entries
            </span>
          </div>

          {groups.map((g) => (
            <div key={g.date}>
              <div className="flex items-center justify-between gap-3 border-b border-divider bg-surface-band px-5 py-[9px]">
                <span className="text-meta font-extrabold tracking-[0.06em] text-foreground uppercase">{g.date}</span>
                <span className="text-caption text-faint">{g.rows.length === 1 ? '1 entry' : `${g.rows.length} entries`}</span>
              </div>
              {g.rows.map((a) => {
                const person = people.find((p) => p.name === a.who)
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-[13px] border-b border-divider px-5 py-[13px] last:border-b-0">
                    {person ? (
                      <PersonAvatar person={person} units={units} className="size-[30px]" />
                    ) : (
                      <Avatar name={a.who || '?'} className="size-[30px]">
                        <AvatarFallback className="text-micro" />
                      </Avatar>
                    )}
                    <span className="min-w-0 flex-[1_1_240px]">
                      <span className="block text-ui leading-[1.45] font-bold text-pretty text-foreground">{a.text}</span>
                      <span className="mt-1 block text-caption text-faint">
                        {a.who} · {a.app}
                      </span>
                    </span>
                    <Badge variant="secondary" size="sm">
                      {a.scope}
                    </Badge>
                    {a.sev === 'high' && (
                      <Badge variant="warning" size="sm">
                        Significant
                      </Badge>
                    )}
                    <span className="shrink-0 text-meta text-faint tabular-nums">{a.when.split(',').slice(1).join(',').trim() || a.when}</span>
                  </div>
                )
              })}
            </div>
          ))}
          {shown.length === 0 && <div className="px-5 py-6 text-ui-sm text-body">{aq ? `Nothing in the log matches “${q.trim()}”.` : 'Nothing has happened in that area yet.'}</div>}
        </Card>
      </div>
    </div>
  )
}
