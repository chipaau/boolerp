import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { ConfirmDialog } from '@workspace/ui/components/confirm-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@workspace/ui/components/dropdown-menu'
import { EmptyState } from '@workspace/ui/components/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { useToast } from '@workspace/ui/components/toast'
import { cn } from '@workspace/ui/lib/utils'
import { formatMvr } from '@/features/billing/logic'
import { useTenantBilling } from '@/features/billing/queries'
import { childrenOf, pendingAdmins, seatPct, statusLabel } from './logic'
import { useAppCatalog, useArchiveTenant, useReactivateTenant, useSuspendTenant, useTenantDirectory, useTenantProfileActions } from './queries'
import type { DirectoryTenant } from './types'
import { TenantBillingTab } from './tenant-billing-tab'
import { DetailCard, INVITE_TONE, LinkAction, Overline, STATUS_TONE, SeatBar } from './tenant-detail-bits'
import { TenantDrawer } from './tenant-drawers'
import type { TenantDrawerState } from './tenant-drawers'

export const TENANT_TABS = [
  ['overview', 'Overview'],
  ['addresses', 'Address & contact'],
  ['apps', 'Apps & modules'],
  ['admins', 'Admin users'],
  ['billing', 'Billing'],
  ['activity', 'Activity'],
] as const
export type TenantTab = (typeof TENANT_TABS)[number][0]

/** Operator view of one tenant: header with plan and lifecycle actions, then six tabs. */
export function TenantDetailPage({ slug, tab, onTabChange }: { slug: string; tab: TenantTab; onTabChange: (tab: TenantTab) => void }) {
  const { tenants, isLoading } = useTenantDirectory()
  const t = tenants.find((x) => x.slug === slug)

  if (!t) {
    return (
      <div className="px-8 py-7">
        <BackLink />
        {isLoading ? null : <EmptyState title="No tenant with that address" description={`Nothing is registered under “${slug}”. It may have been renamed or never created.`} />}
      </div>
    )
  }
  return <TenantDetail key={t.slug} tenant={t} tenants={tenants} tab={tab} onTabChange={onTabChange} />
}

function BackLink() {
  return (
    <Button variant="link" size="xs" render={<Link to="/tenants" />} className="mb-3.5 text-compact">
      <ChevronLeft className="size-3.5" strokeWidth={1.8} />
      All tenants
    </Button>
  )
}

function TenantDetail({ tenant: t, tenants, tab, onTabChange }: { tenant: DirectoryTenant; tenants: DirectoryTenant[]; tab: TenantTab; onTabChange: (tab: TenantTab) => void }) {
  const [drawer, setDrawer] = useState<TenantDrawerState>(null)
  const parent = t.parentSlug ? tenants.find((x) => x.slug === t.parentSlug) : undefined
  const kids = childrenOf(tenants, t.slug)

  return (
    <div className="px-8 py-7">
      <BackLink />
      <TenantHeader tenant={t} parent={parent} onOpen={setDrawer} />

      {/* the shared underline tabs as-is: an overflow on the list clipped the sliding sage rule and drew a scrollbar under the row */}
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as TenantTab)} className="gap-[22px]">
        <TabsList className="flex-wrap gap-y-2">
          {TENANT_TABS.map(([k, label]) => (
            <TabsTrigger key={k} value={k}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab tenant={t} parent={parent} kids={kids} onOpen={setDrawer} onTab={onTabChange} />
        </TabsContent>
        <TabsContent value="addresses">
          <AddressesTab tenant={t} />
        </TabsContent>
        <TabsContent value="apps">
          <AppsTab tenant={t} />
        </TabsContent>
        <TabsContent value="admins">
          <AdminsTab tenant={t} onOpen={setDrawer} />
        </TabsContent>
        <TabsContent value="billing">
          <TenantBillingTab tenant={t} onOpen={setDrawer} />
        </TabsContent>
        <TabsContent value="activity">
          <Card className="gap-0 px-6 pt-2 pb-[18px]">
            {t.activity.map((ev, i) => (
              <div key={i} className="grid grid-cols-[130px_minmax(0,1fr)] gap-[18px] border-b border-divider py-3.5 last:border-b-0">
                <span className="text-compact text-muted-foreground">{ev.when}</span>
                <div className="min-w-0">
                  <div className="text-ui-sm text-foreground">{ev.what}</div>
                  <div className="mt-[3px] text-caption text-muted-foreground">{ev.who}</div>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>

      <TenantDrawer tenant={t} drawer={drawer} onOpen={setDrawer} onClose={() => setDrawer(null)} />
    </div>
  )
}

// ------------------------------------------------------------------------------------------
// Header + Manage tenant menu
// ------------------------------------------------------------------------------------------

// the plate's tint follows the lifecycle, so a suspended or not-yet-live tenant reads at a glance
const PLATE: Record<DirectoryTenant['directoryStatus'], string> = {
  active: 'bg-sage-soft text-sage-soft-foreground [--plate-edge:var(--sage)]',
  suspended: 'bg-tone-warning-soft text-tone-warning-foreground [--plate-edge:var(--tone-warning)]',
  archived: 'bg-tone-danger-soft text-tone-danger-foreground [--plate-edge:var(--tone-danger)]',
  pending: 'bg-tone-slate-soft text-tone-slate-foreground [--plate-edge:var(--tone-slate)]',
  provisioning: 'bg-tone-slate-soft text-tone-slate-foreground [--plate-edge:var(--tone-slate)]',
  draft: 'bg-surface-band text-body [--plate-edge:var(--border)]',
}

/** The tenant's identity plate: its abbreviation in bold mono on a tinted tile with a hairline edge, like the rail's glyph plates. */
function IdentityPlate({ abbr, status }: { abbr: string; status: DirectoryTenant['directoryStatus'] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid h-14 min-w-14 shrink-0 place-items-center rounded-[14px] px-2 font-mono text-ui-lg font-bold tracking-[-0.02em] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--plate-edge)_28%,transparent)]',
        PLATE[status]
      )}
    >
      {abbr}
    </span>
  )
}

function TenantHeader({ tenant: t, parent, onOpen }: { tenant: DirectoryTenant; parent?: DirectoryTenant; onOpen: (d: TenantDrawerState) => void }) {
  const toast = useToast()
  const { setStatus, resendPendingInvites } = useTenantProfileActions()
  const suspend = useSuspendTenant()
  const reactivate = useReactivateTenant()
  const archive = useArchiveTenant()
  const [confirmArchive, setConfirmArchive] = useState(false)
  const pending = pendingAdmins(t.admins)
  const suspended = t.directoryStatus === 'suspended'
  const archived = t.directoryStatus === 'archived'

  const facts = [t.orgType, t.entityType, t.district].join(' · ') + (t.activeFrom !== '—' ? ` · active from ${t.activeFrom}` : '')

  const toggleSuspension = () => {
    const done = suspended ? `${t.abbr} is active again.` : `${t.abbr} suspended — every sign-in is blocked until you lift it.`
    if (t.apiId) {
      const id = t.apiId
      const [run, back] = suspended ? [reactivate, suspend] : [suspend, reactivate]
      run.mutate(id, {
        onSuccess: () => toast(done, { undo: () => back.mutate(id, { onError: (e) => toast(e.message, { ok: false }) }) }),
        onError: (e) => toast(e.message, { ok: false }),
      })
      return
    }
    toast(done, { undo: setStatus(t.slug, suspended ? 'Active' : 'Suspended') })
  }

  const resend = () => {
    if (!pending) return toast(`No pending invites on ${t.abbr}.`)
    toast(`${pending} invite(s) re-sent for ${t.abbr}.`, { undo: resendPendingInvites(t.slug) })
  }

  const menu: { label: string; hint?: string; run: () => void; hidden?: boolean; danger?: boolean }[] = [
    { label: 'Change plan & seats', hint: t.plan, run: () => onOpen({ type: 'plan' }) },
    { label: 'Set parent tenant', hint: parent ? parent.abbr : 'None', run: () => onOpen({ type: 'parent' }) },
    { label: 'Add an admin user', run: () => onOpen({ type: 'admin' }) },
    { label: 'Resend pending invites', hint: pending ? String(pending) : undefined, run: resend },
    { label: suspended ? 'Lift suspension' : 'Suspend tenant', run: toggleSuspension, hidden: archived },
    { label: 'Export tenant record', hint: 'CSV', run: () => toast('Tenant record exported as CSV.') },
  ]

  return (
    <Card className="mb-[18px] gap-0 px-[26px] pt-6 pb-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <IdentityPlate abbr={t.abbr} status={t.directoryStatus} />
          <div className="min-w-0">
            {parent ? (
              <Link to="/tenants/$slug" params={{ slug: parent.slug }} className="mb-2 block w-fit text-overline text-link hover:underline">
                Child of {parent.name}
              </Link>
            ) : (
              <div className="mb-2 text-overline text-faint">{t.orgType === 'Not set' ? 'Tenant' : t.orgType}</div>
            )}
            <h1 className="text-[30px] leading-none font-medium tracking-[-0.022em] text-foreground">{t.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-[9px]">
              <Badge size="sm" variant={STATUS_TONE[t.directoryStatus]}>
                {statusLabel(t.directoryStatus)}
              </Badge>
              <Badge size="sm" variant="secondary" className="font-mono font-normal">
                {t.regNo}
              </Badge>
              <span className="text-meta text-muted-foreground">{facts}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => onOpen({ type: 'plan' })}>
            Change plan
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button />}>
              Manage tenant
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[240px]">
              {menu
                .filter((m) => !m.hidden)
                .map((m) => (
                  <DropdownMenuItem key={m.label} onClick={m.run} className="gap-3">
                    <span className="min-w-0 flex-1">{m.label}</span>
                    {m.hint && <span className="shrink-0 text-fine text-muted-foreground">{m.hint}</span>}
                  </DropdownMenuItem>
                ))}
              {t.apiId && !archived && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirmArchive(true)}>
                    Archive tenant
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title={`Archive ${t.name}?`}
        description="This cannot be undone in this version — the tenant is permanently marked as ceased."
        action="Archive"
        danger
        onClose={() => setConfirmArchive(false)}
        onConfirm={() => {
          setConfirmArchive(false)
          if (!t.apiId) return
          archive.mutate(t.apiId, {
            onSuccess: () => toast(`${t.name} archived`),
            onError: (e) => toast(e.message, { ok: false }),
          })
        }}
      />
    </Card>
  )
}

// ------------------------------------------------------------------------------------------
// Overview
// ------------------------------------------------------------------------------------------

function OverviewTab({
  tenant: t,
  parent,
  kids,
  onOpen,
  onTab,
}: {
  tenant: DirectoryTenant
  parent?: DirectoryTenant
  kids: DirectoryTenant[]
  onOpen: (d: TenantDrawerState) => void
  onTab: (tab: TenantTab) => void
}) {
  const catalog = useAppCatalog()
  const { openCount, openTotal } = useTenantBilling(t.slug)
  const pct = seatPct(t)
  const pending = pendingAdmins(t.admins)
  const appsOn = Object.keys(t.apps).length
  const modsOn = Object.values(t.apps).reduce((n, m) => n + m.length, 0)

  const stats: { label: string; value: string; unit?: string; note: string; bar?: number; act: string; run: () => void }[] = [
    { label: 'Plan', value: t.plan, note: 'Sets the seat ceiling and which apps can be turned on.', act: 'Change plan', run: () => onOpen({ type: 'plan' }) },
    {
      label: 'Seats',
      value: String(t.seatsUsed),
      unit: `of ${t.seatLimit}`,
      note: pct > 90 ? 'Nearly full — raise the limit before they add more people.' : 'Counted across every app this tenant uses.',
      bar: pct,
      act: 'Adjust seats',
      run: () => onOpen({ type: 'plan' }),
    },
    {
      label: 'Admin users',
      value: String(t.admins.length),
      unit: pending ? `${pending} pending` : 'all accepted',
      note: t.admins.length ? 'They manage people and settings inside the tenant.' : 'A tenant cannot go live without one.',
      act: 'Manage',
      run: () => onTab('admins'),
    },
    { label: 'Apps on', value: String(appsOn), unit: `of ${catalog.length}`, note: `${modsOn} modules enabled in total.`, act: 'Review apps', run: () => onTab('apps') },
    {
      label: 'Open balance',
      value: openTotal ? formatMvr(openTotal).replace('MVR ', '') : '0',
      unit: 'MVR',
      note: openCount ? `${openCount} invoice(s) not settled yet.` : 'Everything invoiced has been paid.',
      act: 'Open billing',
      run: () => onTab('billing'),
    },
  ]

  const tree = [
    ...(parent ? [{ t: parent, role: 'Parent tenant', self: false, child: false }] : []),
    { t, role: parent ? 'This tenant' : kids.length ? 'Parent tenant' : 'This tenant', self: true, child: false },
    ...kids.map((k) => ({ t: k, role: 'Child tenant', self: false, child: true })),
  ]

  return (
    <div>
      <Card className="mb-[18px] grid gap-0 overflow-hidden py-0 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        {stats.map((s) => (
          <button key={s.label} type="button" onClick={s.run} className="min-w-0 border-divider px-[21px] pt-[19px] pb-[18px] text-left transition-colors duration-instant ease-hexa not-last:border-r hover:bg-surface-soft">
            <Overline>{s.label}</Overline>
            <div className="mt-3 flex items-baseline gap-[7px]">
              <span className="text-[26px] font-bold tracking-[-0.025em] text-foreground">{s.value}</span>
              {s.unit && <span className="text-meta text-muted-foreground">{s.unit}</span>}
            </div>
            {s.bar !== undefined && <SeatBar className="mt-3" pct={s.bar} />}
            <div className="mt-2.5 text-caption leading-[1.45] text-muted-foreground">{s.note}</div>
            <span className="mt-[11px] inline-block text-caption font-bold text-link">{s.act} →</span>
          </button>
        ))}
      </Card>

      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <DetailCard heading="Identity" className="pb-2">
          <div className="grid gap-x-[26px] sm:grid-cols-2">
            {[
              { label: 'Registration no.', value: t.regNo },
              { label: 'Abbreviation', value: t.abbr },
              { label: 'Organization type', value: t.orgType },
              { label: 'Entity type', value: t.entityType },
              { label: 'Active from', value: t.activeFrom },
              { label: 'Tenant tree', value: parent ? `Child of ${parent.abbr}` : kids.length ? `Parent of ${kids.length}` : 'Standalone' },
            ].map((r) => (
              <div key={r.label} className="border-b border-divider py-[13px]">
                <div className="text-fine text-muted-foreground">{r.label}</div>
                <div className="mt-1 text-ui-sm font-bold text-foreground">{r.value}</div>
              </div>
            ))}
          </div>
        </DetailCard>

        <div className="flex flex-col gap-[18px]">
          <DetailCard heading="Tenant hierarchy" aside={<LinkAction onClick={() => onOpen({ type: 'parent' })}>Edit</LinkAction>}>
            <div className="mt-1.5">
              {tree.map((n) => (
                <Link
                  key={n.t.slug}
                  to="/tenants/$slug"
                  params={{ slug: n.t.slug }}
                  className={cn('flex items-center gap-[11px] rounded-[11px] px-3 py-[11px] transition-colors duration-instant ease-hexa hover:bg-surface-soft', n.self && 'bg-sage-soft hover:bg-sage-soft')}
                >
                  {n.child && <span aria-hidden="true" className="h-px w-3.5 shrink-0 bg-border" />}
                  <div className="min-w-0 flex-1">
                    <div className={cn('truncate text-ui-sm font-bold', n.self ? 'text-foreground' : 'text-body')}>{n.t.name}</div>
                    <div className="mt-0.5 text-fine text-muted-foreground">{n.role}</div>
                  </div>
                  <Badge size="sm" variant={n.self ? 'success' : 'secondary'}>
                    {n.t.plan}
                  </Badge>
                </Link>
              ))}
            </div>
            {!parent && !kids.length && (
              <p className="mt-2.5 text-caption leading-[1.5] text-muted-foreground">Standalone tenant. Give it a parent, or add child tenants under it, from Manage tenant.</p>
            )}
          </DetailCard>

          <DetailCard heading="Latest activity" aside={<LinkAction onClick={() => onTab('activity')}>See all</LinkAction>} className="pb-3">
            {t.activity.slice(0, 3).map((ev, i) => (
              <div key={i} className="border-b border-divider py-3 last:border-b-0">
                <div className="text-ui-sm leading-[1.45] text-foreground">{ev.what}</div>
                <div className="mt-1 text-fine text-muted-foreground">
                  {ev.when} · {ev.who}
                </div>
              </div>
            ))}
          </DetailCard>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------------
// Address & contact
// ------------------------------------------------------------------------------------------

function AddressesTab({ tenant: t }: { tenant: DirectoryTenant }) {
  const mirrored = t.mail.startsWith('Same as')
  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-2">
      <DetailCard heading="Registered address" aside={<Badge size="sm" variant="secondary">On file</Badge>}>
        <div className="mt-1.5 text-ui leading-[1.65] text-foreground">{t.addr}</div>
        <div className="text-ui-sm leading-[1.65] text-body">
          {t.district}, {t.country}
        </div>
      </DetailCard>
      <DetailCard
        heading="Mailing address"
        aside={
          <Badge size="sm" variant={mirrored ? 'secondary' : 'slate'}>
            {mirrored ? 'Mirrored' : 'Separate'}
          </Badge>
        }
      >
        <div className="mt-1.5 text-ui leading-[1.65] text-foreground">{t.mail}</div>
      </DetailCard>
      <DetailCard heading="Contact">
        {[
          { label: 'Contact no.', value: t.contact },
          { label: 'E-mail', value: t.email },
          { label: 'Country', value: t.country },
          { label: 'District', value: t.district },
        ].map((c) => (
          <div key={c.label} className="grid grid-cols-[minmax(100px,0.7fr)_minmax(0,1.4fr)] gap-4 border-b border-divider py-2.5 last:border-b-0">
            <span className="text-compact text-muted-foreground">{c.label}</span>
            <span className="text-ui-sm font-bold text-body">{c.value}</span>
          </div>
        ))}
      </DetailCard>
    </div>
  )
}

// ------------------------------------------------------------------------------------------
// Apps & modules (read-only, as in the design)
// ------------------------------------------------------------------------------------------

function AppsTab({ tenant: t }: { tenant: DirectoryTenant }) {
  const catalog = useAppCatalog()
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {catalog.map((a) => {
        const enabled = t.apps[a.name]
        return (
          <div key={a.name} className={cn('border-b border-divider px-[22px] py-[18px] last:border-b-0', !enabled && 'opacity-55')}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-ui-lg font-bold text-foreground">{a.name}</div>
                <div className="mt-1 text-meta text-muted-foreground">{a.note}</div>
              </div>
              <Badge size="sm" variant={enabled ? 'success' : 'neutral'}>
                {enabled ? 'On' : 'Off'}
              </Badge>
            </div>
            {enabled && (
              <div className="mt-[13px] flex flex-wrap gap-[7px]">
                {a.modules.map((m) => {
                  const on = enabled.includes(m)
                  return (
                    <Badge key={m} size="sm" variant={on ? 'secondary' : 'neutral'} className={cn(!on && 'opacity-50')}>
                      {m}
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}

// ------------------------------------------------------------------------------------------
// Admin users
// ------------------------------------------------------------------------------------------

function AdminsTab({ tenant: t, onOpen }: { tenant: DirectoryTenant; onOpen: (d: TenantDrawerState) => void }) {
  const toast = useToast()
  const { removeAdmin, resendInvite } = useTenantProfileActions()

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {t.admins.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">ID no.</TableHead>
              <TableHead className="hidden md:table-cell">E-mail</TableHead>
              <TableHead className="hidden md:table-cell">Invite</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {t.admins.map((a) => {
              const accepted = a.invite === 'Accepted'
              const run = () => {
                if (!accepted) return toast(`Invite re-sent to ${a.email}.`, { undo: resendInvite(t.slug, a.idNo) })
                if (t.admins.length < 2) return toast(`Removing ${a.name} needs a second admin on this tenant.`, { ok: false })
                toast(`${a.name} removed from ${t.abbr}.`, { undo: removeAdmin(t.slug, a.idNo) })
              }
              return (
                <TableRow key={a.idNo}>
                  <TableCell>
                    <div className="text-ui-sm font-bold text-foreground">{a.name}</div>
                    <div className="mt-[3px] text-caption text-muted-foreground">{a.last}</div>
                    <div className="mt-[3px] text-caption text-muted-foreground md:hidden">
                      {a.idNo} · {a.email} · {a.invite}
                    </div>
                  </TableCell>
                  <TableCell className="hidden font-mono text-caption text-body md:table-cell">{a.idNo}</TableCell>
                  <TableCell className="hidden max-w-[240px] truncate text-compact text-body md:table-cell">{a.email}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge size="sm" variant={INVITE_TONE[a.invite]}>
                      {a.invite}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="xs" onClick={run}>
                      {accepted ? 'Remove' : 'Resend invite'}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
      {!t.admins.length && <p className="px-5 py-[22px] text-center text-compact text-muted-foreground">No admin user on this tenant yet — it cannot be activated until there is one.</p>}
      <div className="border-t border-divider px-5 py-3.5">
        <Button variant="outline" onClick={() => onOpen({ type: 'admin' })}>
          Add an admin user
        </Button>
      </div>
    </Card>
  )
}
