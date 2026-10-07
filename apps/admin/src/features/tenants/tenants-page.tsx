import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronRight, Copy, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@workspace/ui/components/alert'
import { Badge } from '@workspace/ui/components/badge'
import type { BadgeTone } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { ConfirmDialog } from '@workspace/ui/components/confirm-dialog'
import { SelectField } from '@workspace/ui/components/select'
import { SearchField } from '@workspace/ui/components/search-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { matchesQuery, useAdminSearch } from '@/components/layout/search-context'
import { routeLink } from '@/lib/route-link'
import { AddTenantWizard } from './add-tenant-wizard'
import type { Provisioned } from './add-tenant-wizard'
import { childrenOf, isNearSeatLimit, orderByHierarchy, pendingAdmins, seatPct, statusLabel } from './logic'
import { useOrgTypes, usePlans, useTenantDirectory, useTenantProfileActions } from './queries'
import type { DirectoryStatus, DirectoryTenant } from './types'

type StatusFilter = 'all' | 'active' | 'pending' | 'suspended' | 'draft' | 'archived'

const CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending activation' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'draft', label: 'Draft' },
]

const STATUS_TONE: Record<DirectoryStatus, BadgeTone> = {
  active: 'success',
  suspended: 'warning',
  pending: 'slate',
  provisioning: 'slate',
  draft: 'neutral',
  archived: 'danger',
}

const inFilter = (s: DirectoryStatus, f: StatusFilter) =>
  f === 'all' || (f === 'pending' ? s === 'pending' || s === 'provisioning' : s === f)

type Action = 'suspend' | 'reactivate' | 'archive'
type PendingTransition = { tenant: DirectoryTenant; action: Action }

const TRANSITION_COPY: Record<Action, { verb: string; pastTense: string; description: string; danger?: boolean }> = {
  suspend: { verb: 'Suspend', pastTense: 'suspended', description: 'Every sign-in to the tenant is blocked straight away. Reactivate lifts it.' },
  reactivate: { verb: 'Reactivate', pastTense: 'reactivated', description: 'The tenant can sign in again straight away.' },
  archive: { verb: 'Archive', pastTense: 'archived', description: 'The tenant is marked as ceased. This cannot be undone in this version.', danger: true },
}

/** Row actions: API tenants get the real lifecycle; fixture-only tenants can only be suspended or reactivated. */
function actionsFor(t: DirectoryTenant): Action[] {
  const s = t.directoryStatus
  if (s === 'archived') return []
  const out: Action[] = []
  if (s === 'active') out.push('suspend')
  if (s === 'suspended') out.push('reactivate')
  if (t.apiId) out.push('archive')
  return out
}

/**
 * The tenants list from the design: summary line, a filter bar (text, status chips, org type and plan
 * selects, count, clear), then the hierarchy-ordered table where child tenants sit indented under
 * their parent. A row opens the tenant; lifecycle buttons sit at the row's end. "New tenant" swaps
 * the list for the add-tenant wizard, as the design does.
 */
export function TenantsPage() {
  const { tenants } = useTenantDirectory()
  const plans = usePlans()
  const orgTypes = useOrgTypes()
  const { query: globalQuery, setQuery: setGlobalQuery } = useAdminSearch()
  const toast = useToast()
  const navigate = useNavigate()
  const profileActions = useTenantProfileActions()

  // The sidebar's "Needs attention" rows land here with ?status=pending|active.
  const urlStatus: string | undefined = useSearch({ strict: false }).status
  const [status, setStatus] = useState<StatusFilter>('all')
  useEffect(() => {
    if (urlStatus && CHIPS.some((c) => c.key === urlStatus)) setStatus(urlStatus as StatusFilter)
  }, [urlStatus])

  const [q, setQ] = useState('')
  const [org, setOrg] = useState('')
  const [plan, setPlan] = useState('')
  const [wizard, setWizard] = useState(false)
  const [provisioned, setProvisioned] = useState<Provisioned | null>(null)
  const [pending, setPending] = useState<PendingTransition | null>(null)

  const hasArchived = tenants.some((t) => t.directoryStatus === 'archived')
  const chips = hasArchived ? [...CHIPS, { key: 'archived' as const, label: 'Archived' }] : CHIPS

  const rows = useMemo(() => {
    const list = tenants.filter(
      (t) =>
        matchesQuery(`${t.name} ${t.abbr} ${t.slug} ${t.regNo} ${t.orgType} ${t.entityType}`, `${globalQuery} ${q}`) &&
        inFilter(t.directoryStatus, status) &&
        (!org || t.orgType === org) &&
        (!plan || t.plan === plan)
    )
    return orderByHierarchy(list)
  }, [tenants, globalQuery, q, status, org, plan])

  const filtersOn = !!(q || globalQuery || status !== 'all' || org || plan)
  const clearFilters = () => {
    setQ('')
    setGlobalQuery('')
    setStatus('all')
    setOrg('')
    setPlan('')
  }

  const count = (f: StatusFilter) => tenants.filter((t) => inFilter(t.directoryStatus, f)).length
  const notLive = tenants.filter((t) => t.directoryStatus === 'pending' || t.directoryStatus === 'provisioning' || t.directoryStatus === 'draft').length

  // Fixtures only (F2f): the prototype's tenants have no apiId, so the API branch this once had was
  // already unreachable. The real lifecycle endpoints belong to the new list.
  const runTransition = () => {
    if (!pending) return
    const { tenant, action } = pending
    const copy = TRANSITION_COPY[action]
    const undo = profileActions.setStatus(tenant.slug, action === 'suspend' ? 'Suspended' : 'Active')
    toast(`${tenant.name} ${copy.pastTense}`, { undo })
    setPending(null)
  }

  const open = (slug: string) => void navigate(routeLink('/tenants/$slug', undefined, { slug }) as never)

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      {wizard && (
        <AddTenantWizard
          onClose={() => setWizard(false)}
          onProvisioned={(p) => {
            setProvisioned(p)
            setWizard(false)
          }}
        />
      )}
      <div className="px-8 pt-[26px] pb-24">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-[29px] leading-none font-black tracking-[-0.02em] text-foreground">Tenants</h1>
            <p className="mt-[9px] text-sm text-faint">
              {count('active')} active · {notLive} not yet live · {count('suspended')} suspended
            </p>
          </div>
          <Button onClick={() => setWizard(true)}>New tenant</Button>
        </div>

        {provisioned && (
          <Alert variant="success" className="mb-3.5">
            <AlertTitle>{provisioned.name} is live</AlertTitle>
            <AlertDescription>
              <p>Send the owner this one-time link to set their password. It is shown once.</p>
              <div className="flex w-full flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-sm bg-card px-2.5 py-1.5 font-mono text-xs text-foreground">{provisioned.recoveryLink}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(provisioned.recoveryLink)
                    toast('Recovery link copied')
                  }}
                >
                  <Copy /> Copy
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setProvisioned(null)}>
                  <X />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card className="mb-3.5 flex-row flex-wrap items-center gap-2.5 px-3.5 py-3">
          <SearchField
            size="sm"
            className="h-8 max-w-[300px] min-w-[210px] flex-[1_1_210px]"
            placeholder="Filter by name or reg no."
            aria-label="Filter by name or reg no."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {chips.map((c) => (
            <Badge
              key={c.key}
              variant={status === c.key ? 'filter-active' : 'filter'}
              render={<button type="button" aria-pressed={status === c.key} onClick={() => setStatus(c.key)} />}
            >
              {c.label}
            </Badge>
          ))}
          <SelectField
            aria-label="Organization type"
            value={org}
            onValueChange={setOrg}
            className="w-auto"
            options={[{ value: '', label: 'Any type' }, ...orgTypes.map((o) => ({ value: o, label: o }))]}
          />
          <SelectField
            aria-label="Plan"
            value={plan}
            onValueChange={setPlan}
            className="w-auto"
            options={[{ value: '', label: 'Any plan' }, ...plans.map((p) => ({ value: p.name, label: p.name }))]}
          />
          <span className="flex-1" />
          <span className="text-meta whitespace-nowrap text-faint">
            {rows.length} of {tenants.length} tenants
          </span>
          {filtersOn && (
            <Button variant="link" size="xs" className="text-meta font-bold no-underline hover:underline" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </Card>

        <Card className="gap-0 overflow-clip py-0">
          <Table>
            <TableHeader>
              <TableRow className="h-auto hover:bg-transparent">
                <TableHead className="min-w-[220px]">Tenant</TableHead>
                <TableHead className="max-lg:hidden">Reg no.</TableHead>
                <TableHead className="max-lg:hidden">Organization type</TableHead>
                <TableHead className="max-lg:hidden">Admins</TableHead>
                <TableHead className="w-[150px] max-lg:hidden">Plan &amp; seats</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-8">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ tenant: t, isChild }) => {
                const kids = childrenOf(tenants, t.slug).length
                const waiting = pendingAdmins(t.admins)
                const pct = seatPct(t)
                const label = statusLabel(t.directoryStatus)
                return (
                  <TableRow key={t.slug} className="group cursor-pointer" onClick={() => open(t.slug)}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2.5">
                        {isChild && <span aria-hidden="true" className="h-px w-4 shrink-0 bg-border" />}
                        {kids > 0 && (
                          <span
                            className="grid size-5 shrink-0 place-items-center rounded-[6px] bg-muted text-micro font-bold text-faint"
                            title={`${kids} child tenant${kids > 1 ? 's' : ''}`}
                          >
                            {kids}
                          </span>
                        )}
                        <div className="min-w-0">
                          <Link
                            {...routeLink('/tenants/$slug', undefined, { slug: t.slug })}
                            onClick={(e) => e.stopPropagation()}
                            className="block truncate text-sm font-bold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {t.name}
                          </Link>
                          <div className="mt-[3px] text-xs text-faint">
                            {t.abbr} · {t.entityType}
                            {kids > 0 && ` · ${kids} child tenant${kids > 1 ? 's' : ''}`}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-body max-lg:hidden">{t.regNo}</TableCell>
                    <TableCell className="truncate text-compact text-body max-lg:hidden">{t.orgType}</TableCell>
                    <TableCell
                      className={cn(
                        'text-compact max-lg:hidden',
                        !t.admins.length ? 'text-tone-risk-foreground' : waiting ? 'text-tone-warning-foreground' : 'text-body'
                      )}
                    >
                      {t.admins.length ? `${t.admins.length}${waiting ? ` · ${waiting} pending` : ''}` : 'None'}
                    </TableCell>
                    <TableCell className="max-lg:hidden">
                      <div className="text-compact font-bold text-body">
                        {t.plan} · {t.seatsUsed}/{t.seatLimit}
                      </div>
                      <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-surface-band">
                        <span
                          className={cn('block h-full rounded-full transition-[width] duration-500', isNearSeatLimit(t) ? 'bg-tone-warning' : 'bg-tone-success')}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={STATUS_TONE[t.directoryStatus]} size="sm">
                        {/* Text stays lowercase (the e2e contract reads it); the first letter is capitalised visually. */}
                        <span className="inline-block first-letter:uppercase">{label.toLowerCase()}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        {actionsFor(t).map((a) => (
                          <Button
                            key={a}
                            variant="outline"
                            size="xs"
                            className={cn(a === 'archive' && 'text-tone-risk-foreground')}
                            onClick={(e) => {
                              e.stopPropagation()
                              setPending({ tenant: t, action: a })
                            }}
                          >
                            {TRANSITION_COPY[a].verb}
                          </Button>
                        ))}
                        <ChevronRight
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-faint transition-transform duration-instant group-hover:translate-x-[3px]"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-[30px] text-center">
                    <div className="text-sm text-body">No tenant matches those filters.</div>
                    <Button variant="link" size="xs" className="mt-2 font-bold no-underline hover:underline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <ConfirmDialog
        open={!!pending}
        title={pending ? `${TRANSITION_COPY[pending.action].verb} ${pending.tenant.name}?` : ''}
        description={pending ? TRANSITION_COPY[pending.action].description : ''}
        action={pending ? TRANSITION_COPY[pending.action].verb : ''}
        danger={pending ? TRANSITION_COPY[pending.action].danger : false}
        onClose={() => setPending(null)}
        onConfirm={runTransition}
      />
    </div>
  )
}
