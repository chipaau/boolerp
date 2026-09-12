import { Link, useLocation } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@workspace/ui/components/dropdown-menu'
import { useSidebar } from '@workspace/ui/components/sidebar'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import type { AppDef } from '@/lib/apps'
import { isOnBooks, liveUnits, unitPath } from '@/features/org/logic'
import { useAuditLog, useOrgMe, usePeople, useSiteTypes, useSites, useUnits } from '@/features/org/queries'
import { useAttention } from './attention'

const row = (on: boolean) =>
  cn('flex w-full items-center gap-2 rounded-lg py-[7px] pr-2.5 pl-2.5 text-left text-ui-sm outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring', on ? 'bg-sidebar-accent font-bold text-foreground' : 'text-body hover:bg-sidebar-hover hover:text-foreground')

/**
 * Control Centre's rail: the sections with live counts, then what needs a look (the same list
 * the overview shows), the viewer's role in a line, and the export menu.
 */
export function ControlRail({ app }: { app: AppDef }) {
  const { pathname } = useLocation()
  const units = useUnits(), people = usePeople(), sites = useSites(), types = useSiteTypes()
  const me = useOrgMe()
  const attention = useAttention()
  const collapsed = useSidebar().state === 'collapsed'
  const toast = useToast()
  const log = useAuditLog()
  const section = pathname.replace(/^\/control-centre\/?/, '').split('/')[0]
  const counts: Partial<Record<string, number>> = { units: liveUnits(units).length, employees: people.filter(isOnBooks).length, 'site-types': types.length, sites: sites.length }

  function exportCsv(kind: string) {
    const rows: string[][] =
      kind === 'employees' ? [['Code', 'Name', 'Job title', 'Unit', 'Status', 'Contract', 'Email'], ...people.filter((p) => !p.external).map((p) => [p.id, p.name, p.title, unitPath(units, p.unitId), p.status, p.contract, p.email])]
      : kind === 'units' ? [['Code', 'Name', 'Kind', 'Parent'], ...liveUnits(units).map((u) => [u.code, u.name, u.kind, u.parent ? unitPath(units, u.parent) : ''])]
      : kind === 'sites' ? [['Code', 'Name', 'Region', 'Type', 'Status'], ...sites.map((s) => [s.code, s.name, s.region, types.find((t) => t.id === s.typeId)?.name ?? '', s.status])]
      : [['Name', 'Storage', 'Can issue', 'Bins', 'Counting'], ...types.map((t) => [t.name, t.mode, t.issue ? 'Yes' : 'No', t.bins ? 'Yes' : 'No', t.cadence])]
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const name = `hexa-${kind}.csv`
    try {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } catch {
      // a blocked download still logs the intent
    }
    log('Export', `${name} downloaded`)
    toast(`${name} downloaded`)
  }

  if (collapsed) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-px">
        <Link to="/$app" params={{ app: app.slug }} className={row(section === '')}>
          <span className="flex-1">Overview</span>
        </Link>
      </div>
      {app.menu.filter((g) => g.title).map((g) => (
        <div key={g.title} className="border-t border-sidebar-border pt-4">
          <div className="mb-2 px-2.5 text-overline text-faint">{g.title}</div>
          <ul className="flex flex-col gap-px">
            {g.items.map((it) => (
              <li key={it.slug}>
                <Link to="/$app/$section" params={{ app: app.slug, section: it.slug }} className={row(section === it.slug)}>
                  <span className="flex-1">{it.title}</span>
                  {counts[it.slug] !== undefined && <span className="text-fine tabular-nums text-faint">{counts[it.slug]}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="border-t border-sidebar-border pt-4">
        <div className="mb-2 px-2.5 text-overline text-faint">Needs attention</div>
        {attention.length === 0 && <div className="px-2.5 text-caption text-faint">Nothing needs a look right now.</div>}
        <ul className="flex flex-col gap-px">
          {attention.map((a) => (
            <li key={a.label}>
              <Link to="/$app/$section" params={{ app: app.slug, section: a.to.section }} search={a.to.search} className={row(false)}>
                <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', a.tone === 'warning' ? 'bg-brand-soft' : a.tone === 'risk' ? 'bg-tone-risk' : 'bg-tone-neutral')} />
                <span className="min-w-0 flex-1 truncate font-normal">{a.label}</span>
                <Badge variant={a.tone === 'neutral' ? 'neutral' : 'warning'} size="sm">
                  {a.count}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto border-t border-sidebar-border pt-4 text-caption leading-[1.5] text-faint">
        <div className="px-2.5">{me.role === 'Staff' ? 'Staff can browse all of this but change none of it.' : me.role === 'Manager' ? 'Managers edit sites and employees. Site types and numbering stay with Admins.' : 'Admins control the whole record — organisation, inventory setup and system rules.'}</div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />} className="mt-3 w-full justify-start">
            <Download className="size-3.5" strokeWidth={1.7} />
            Export data
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-1.5">
            {[['employees', 'Employees (CSV)'], ['units', 'Admin units (CSV)'], ['sites', 'Sites (CSV)'], ['site-types', 'Site types (CSV)']].map(([k, label]) => (
              <DropdownMenuItem key={k} onClick={() => exportCsv(k)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
