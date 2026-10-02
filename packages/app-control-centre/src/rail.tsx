import { Link, useLocation } from '@tanstack/react-router'
import { SidebarNavGroups } from '@workspace/ui/components/workspace-sidebar'
import type { SidebarNavGroup } from '@workspace/ui/components/workspace-sidebar'
import type { AppDef } from '@workspace/app-kit'
import { isOpenInvoice } from './features/billing'
import { useAutoInvoicing, useInvoices } from './features/billing'
import { isOnBooks, liveUnits } from '@workspace/org/logic'
import { useApprovalChains, useAudit, useCountries, useHolidays, useNotificationRules, useNumbering, usePeople, useSiteTypes, useSites, useUnits } from '@workspace/org/queries'
import { useAttention } from './features/overview'

/**
 * Control Centre's rail: the sections with live counts, what needs a look (the same list
 * the overview lists) as one total on Overview, unpaid invoices on Billing. Rendered by the
 * shared WorkspaceSidebar rows.
 */
export function ControlRail({ app }: { app: AppDef }) {
  const { pathname } = useLocation()
  const units = useUnits(), people = usePeople(), sites = useSites(), types = useSiteTypes(), holidays = useHolidays()
  const chains = useApprovalChains(), codes = useNumbering(), countries = useCountries(), rules = useNotificationRules(), audit = useAudit()
  const attention = useAttention()
  const invoices = useInvoices()
  // the rail is mounted on every Control Centre page, so due invoices issue whichever one opens
  useAutoInvoicing()
  const unpaid = invoices.filter((i) => isOpenInvoice(i.status)), overdue = unpaid.some((i) => i.status === 'Overdue')
  // one number, like the bell: the overview lists what it is
  const open = attention.reduce((n, a) => n + a.count, 0), risky = attention.some((a) => a.tone === 'risk')
  const section = pathname.replace(/^\/control-centre\/?/, '').split('/')[0]
  const counts: Partial<Record<string, number>> = { units: liveUnits(units).length, employees: people.filter(isOnBooks).length, 'site-types': types.length, sites: sites.length, holidays: holidays.filter((h) => h.on).length,
    approvals: chains.length, codes: codes.length, regions: countries.filter((c) => c.on).length, notifications: rules.filter((r) => r.inApp || r.email).length, activity: audit.length,
  }

  const groups: SidebarNavGroup[] = app.menu.map((g) => ({
    title: g.title,
    items: g.items.map((it) => {
      const base = { key: it.slug || 'overview', title: it.title, icon: it.icon, active: section === it.slug }
      if (!it.slug) {
        return {
          ...base,
          render: <Link to="/$app" params={{ app: app.slug }} />,
          ...(open > 0 && { count: open, countTone: risky ? 'risk' : 'warning', countLabel: `${open} ${open === 1 ? 'item needs' : 'items need'} attention` }),
        } as const
      }
      const billing = it.slug === 'billing' && unpaid.length > 0
      return {
        ...base,
        render: <Link to="/$app/$section" params={{ app: app.slug, section: it.slug }} />,
        count: billing ? unpaid.length : counts[it.slug],
        countTone: billing ? (overdue ? 'risk' : 'warning') : 'neutral',
        countLabel: billing ? `${unpaid.length} ${unpaid.length === 1 ? 'invoice' : 'invoices'} ${overdue ? 'overdue' : 'due'}` : undefined,
      } as const
    }),
  }))

  return <SidebarNavGroups groups={groups} />
}
