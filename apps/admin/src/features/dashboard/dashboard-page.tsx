import { Link } from '@tanstack/react-router'
import { Card } from '@workspace/ui/components/card'
import { EmptyState } from '@workspace/ui/components/empty-state'
import { StatCard } from '@workspace/ui/components/stat-card'
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@workspace/ui/components/table'
import { PageTitle } from '@/components/layout/page'
import { useTenants } from '@/features/tenants/queries'

// Counts are derived client-side from the same tenant list the Tenants page already fetches — no
// dedicated stats endpoint exists yet, and one isn't warranted for four numbers over a list this
// size (operator-facing, hundreds of tenants at most, never millions — see project-context.md).
export function DashboardPage() {
  const { data: tenants, isLoading, isError } = useTenants()

  const total = tenants?.length ?? 0
  const active = tenants?.filter((t) => t.status === 'active').length ?? 0
  const suspended = tenants?.filter((t) => t.status === 'suspended').length ?? 0
  const archived = tenants?.filter((t) => t.status === 'archived').length ?? 0
  const recent = [...(tenants ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)

  return (
    <div className="min-h-0 w-full overflow-y-auto">
      <div className="px-8 pt-7 pb-24">
        <PageTitle overline="Operator Console" title="Dashboard" meta="Every tenant on the platform, at a glance." />

        {isError && <EmptyState title="Could not load tenants" className="py-16" />}

        {!isError && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total tenants" value={isLoading ? '—' : total} />
              <StatCard label="Active" value={isLoading ? '—' : active} />
              <StatCard label="Suspended" value={isLoading ? '—' : suspended} valueClassName={suspended > 0 ? 'text-tone-warning-foreground' : undefined} />
              <StatCard label="Archived" value={isLoading ? '—' : archived} />
            </div>

            <Card className="gap-0 overflow-clip py-0">
              <div className="border-b border-divider px-[22px] py-4">
                <span className="text-ui-sm font-bold text-foreground">Recently provisioned</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="h-auto hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && recent.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No tenants yet —{' '}
                        <Link to="/tenants" className="text-link hover:underline">
                          provision the first one
                        </Link>
                        .
                      </TableCell>
                    </TableRow>
                  )}
                  {recent.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-bold text-foreground">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground">{t.slug}</TableCell>
                      <TableCell>{t.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
