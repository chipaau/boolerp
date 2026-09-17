import { useMemo, useState } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import type { BadgeTone } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card } from '@workspace/ui/components/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@workspace/ui/components/table'
import { useToast } from '@workspace/ui/components/toast'
import { PageTitle } from '@/components/layout/page'
import { FilterPill, FilterSelect, FilterToolbar } from '@/components/filter-toolbar'
import { useTenantDirectory } from '@/features/tenants/queries'
import { useAdminRoles, useAdminUserActions, useAdminUserSummary, useAdminUsers } from './queries'
import type { AdminRole, AdminUser, InviteState } from './types'
import { AdminUserDialog } from './admin-user-drawer'

const ROLE_TONE: Record<AdminRole, BadgeTone | 'secondary'> = { 'Platform admin': 'slate', 'Tenant admin': 'success', Support: 'secondary', 'Read only': 'neutral' }
const INVITE_TONE: Record<InviteState, BadgeTone> = { Accepted: 'success', Invited: 'slate', Expired: 'warning' }
const INVITE_FILTERS = ['Any invite', 'Accepted', 'Invited', 'Expired'] as const

type DrawerState = { mode: 'add' } | { mode: 'edit'; user: AdminUser } | null

/** Admin users screen: operators and tenant admins, with invite state and role filters. */
export function AdminUsersPage({ initialInvite }: { initialInvite?: InviteState }) {
  const users = useAdminUsers()
  const roles = useAdminRoles()
  const summary = useAdminUserSummary()
  const { tenants } = useTenantDirectory()
  const { resendInvite } = useAdminUserActions()
  const toast = useToast()

  const [q, setQ] = useState('')
  const [role, setRole] = useState<'All' | AdminRole>('All')
  const [invite, setInvite] = useState<(typeof INVITE_FILTERS)[number]>(initialInvite ?? 'Any invite')
  const [scope, setScope] = useState('Any scope')
  const [drawer, setDrawer] = useState<DrawerState>(null)

  const scopeOptions = useMemo(() => ['Any scope', 'All tenants', ...new Set(tenants.map((t) => t.abbr))], [tenants])
  const needle = q.trim().toLowerCase()
  const rows = users.filter(
    (u) =>
      (!needle || `${u.name} ${u.idNo} ${u.email} ${u.role} ${u.scope}`.toLowerCase().includes(needle)) &&
      (role === 'All' || u.role === role) &&
      (scope === 'Any scope' || u.scope === scope) &&
      (invite === 'Any invite' || u.invite === invite)
  )
  const filtersOn = !!q || role !== 'All' || scope !== 'Any scope' || invite !== 'Any invite'
  const clear = () => (setQ(''), setRole('All'), setScope('Any scope'), setInvite('Any invite'))

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <PageTitle
          overline="Admin"
          title="Admin users"
          meta={`${summary.total} admin users · ${summary.platformAdmins} ${summary.platformAdmins === 1 ? 'platform admin' : 'platform admins'} · ${summary.pendingInvites} ${summary.pendingInvites === 1 ? 'invite outstanding' : 'invites outstanding'}`}
          actions={<Button onClick={() => setDrawer({ mode: 'add' })}>Add an admin user</Button>}
          className="mb-[18px]"
        />

        <FilterToolbar query={q} onQuery={setQ} placeholder="Filter by name or e-mail" count={`${rows.length} of ${users.length} admin users`} filtersOn={filtersOn} onClear={clear}>
          {(['All', ...roles.map((r) => r.key)] as const).map((r) => (
            <FilterPill key={r} active={role === r} onClick={() => setRole(r)}>
              {r}
            </FilterPill>
          ))}
          <FilterSelect label="Invite" value={invite} options={INVITE_FILTERS} onChange={setInvite} />
          <FilterSelect label="Scope" value={scope} options={scopeOptions} onChange={setScope} />
        </FilterToolbar>

        <Card className="gap-0 overflow-clip py-0">
          <Table>
            <TableHeader>
              <TableRow className="h-auto hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead className="hidden lg:table-cell">ID no.</TableHead>
                <TableHead className="hidden md:table-cell">E-mail</TableHead>
                <TableHead className="hidden md:table-cell">Role</TableHead>
                <TableHead className="hidden lg:table-cell">Scope</TableHead>
                <TableHead className="text-right">Invite</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.idNo}>
                  <TableCell>
                    <div className="font-bold text-foreground">{u.name}</div>
                    <div className="mt-0.5 text-caption text-muted-foreground">
                      {u.nationality} · {u.contact}
                      {u.activeFrom !== '—' && ` · from ${u.activeFrom}`}
                    </div>
                    <div className="text-fine text-muted-foreground md:hidden">
                      {u.role} · {u.scope}
                    </div>
                  </TableCell>
                  <TableCell className="hidden font-mono text-caption text-body lg:table-cell">{u.idNo}</TableCell>
                  <TableCell className="hidden max-w-[240px] truncate text-body md:table-cell">{u.email}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={ROLE_TONE[u.role]} size="sm">
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden max-w-[160px] truncate text-muted-foreground lg:table-cell">{u.scope}</TableCell>
                  <TableCell align="right">
                    <Badge variant={INVITE_TONE[u.invite]} size="sm">
                      {u.invite}
                    </Badge>
                  </TableCell>
                  <TableCell align="right">
                    {u.invite === 'Accepted' ? (
                      <Button variant="outline" size="sm" onClick={() => setDrawer({ mode: 'edit', user: u })}>
                        Edit
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => toast(`Invite re-sent to ${u.email}.`, { undo: resendInvite(u.idNo) })}>
                        Resend
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-[30px] text-center">
                    <div className="text-ui-sm text-body">No admin user matches those filters.</div>
                    <button type="button" onClick={clear} className="mt-2 text-compact font-bold text-link hover:underline">
                      Clear filters
                    </button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <AdminUserDialog open={!!drawer} editing={drawer?.mode === 'edit' ? drawer.user : undefined} onClose={() => setDrawer(null)} />
    </div>
  )
}
