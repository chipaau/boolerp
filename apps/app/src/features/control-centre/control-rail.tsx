import { Link, useLocation } from '@tanstack/react-router'
import { Badge } from '@workspace/ui/components/badge'
import { useSidebar } from '@workspace/ui/components/sidebar'
import { cn } from '@workspace/ui/lib/utils'
import type { AppDef } from '@/lib/apps'
import { isOpenInvoice } from '@/features/billing/logic'
import { useInvoices } from '@/features/billing/queries'
import { isOnBooks, liveUnits } from '@/features/org/logic'
import { useApprovalChains, useAudit, useCountries, useHolidays, useNotificationRules, useNumbering, usePeople, useSiteTypes, useSites, useUnits } from '@/features/org/queries'
import { useAttention } from './attention'

const row = (on: boolean) =>
  cn('flex w-full items-center gap-2 rounded-lg py-[7px] pr-2.5 pl-2.5 text-left text-ui-sm outline-none transition-colors duration-instant focus-visible:ring-2 focus-visible:ring-ring', on ? 'bg-sidebar-accent font-bold text-foreground' : 'text-body hover:bg-sidebar-hover hover:text-foreground')

/**
 * Control Centre's rail: the sections with live counts, what needs a look (the same list
 * the overview lists) as one total on Overview.
 */
export function ControlRail({ app }: { app: AppDef }) {
  const { pathname } = useLocation()
  const units = useUnits(), people = usePeople(), sites = useSites(), types = useSiteTypes(), holidays = useHolidays()
  const chains = useApprovalChains(), codes = useNumbering(), countries = useCountries(), rules = useNotificationRules(), audit = useAudit()
  const attention = useAttention()
  const invoices = useInvoices()
  const unpaid = invoices.filter((i) => isOpenInvoice(i.status)), overdue = unpaid.some((i) => i.status === 'Overdue')
  // one number, like the bell: the overview lists what it is
  const open = attention.reduce((n, a) => n + a.count, 0), risky = attention.some((a) => a.tone === 'risk')
  const collapsed = useSidebar().state === 'collapsed'
  const section = pathname.replace(/^\/control-centre\/?/, '').split('/')[0]
  const counts: Partial<Record<string, number>> = { units: liveUnits(units).length, employees: people.filter(isOnBooks).length, 'site-types': types.length, sites: sites.length, holidays: holidays.filter((h) => h.on).length,
    approvals: chains.length, codes: codes.length, regions: countries.filter((c) => c.on).length, notifications: rules.filter((r) => r.inApp || r.email).length, activity: audit.length,
  }

  if (collapsed) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-px">
        <Link to="/$app" params={{ app: app.slug }} className={row(section === '')}>
          <span className="flex-1">Overview</span>
          {open > 0 && (
            <Badge variant={risky ? 'risk' : 'warning'} size="sm" aria-label={`${open} ${open === 1 ? 'item needs' : 'items need'} attention`}>
              {open}
            </Badge>
          )}
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
                  {it.slug === 'billing' && unpaid.length > 0 && (
                    <Badge variant={overdue ? 'risk' : 'warning'} size="sm" aria-label={`${unpaid.length} ${unpaid.length === 1 ? 'invoice' : 'invoices'} ${overdue ? 'overdue' : 'due'}`}>
                      {unpaid.length}
                    </Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
