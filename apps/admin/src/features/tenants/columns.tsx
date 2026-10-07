import { Badge } from '@workspace/ui/components/badge'
import type { BadgeTone } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import type { DataTableColumn } from '@workspace/ui/components/data-table'
import { cn } from '@workspace/ui/lib/utils'
import type { Tenant, TenantStatus } from './schemas'

/** Status labels and tones, as the tenants page has always shown them. */
const STATUS: Record<TenantStatus, { label: string; tone: BadgeTone }> = {
  provisioning: { label: 'Provisioning', tone: 'slate' },
  active: { label: 'Active', tone: 'success' },
  suspended: { label: 'Suspended', tone: 'warning' },
  archived: { label: 'Archived', tone: 'danger' },
}

export const statusLabel = (s: TenantStatus) => STATUS[s].label

/** The lifecycle actions per status; their endpoints come later, so they show disabled (C184). */
const ACTIONS: Record<TenantStatus, string[]> = {
  provisioning: ['Archive'],
  active: ['Suspend', 'Archive'],
  suspended: ['Reactivate', 'Archive'],
  archived: [],
}
const NOT_YET = 'Not available yet: the tenant lifecycle endpoints come after creating tenants.'

const created = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

/**
 * The tenants table's columns (C174, C179), styled as the tenants page. A sortable column's id is
 * the API's sort field and has an accessor.
 */
export function tenantColumns(): DataTableColumn<Tenant>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Tenant',
      enableSorting: true,
      cell: ({ row: { original: t } }) => (
        <div className="min-w-0">
          <div className="block truncate text-sm font-bold text-foreground">{t.name}</div>
          <div className="mt-[3px] text-xs text-faint">
            {t.code} · {t.slug}
          </div>
        </div>
      ),
      meta: { className: 'min-w-[220px]' },
    },
    {
      id: 'code',
      accessorKey: 'code',
      header: 'Code',
      enableSorting: true,
      cell: ({ row: { original: t } }) => <span className="font-mono text-xs text-body">{t.code}</span>,
      meta: { wide: true },
    },
    {
      id: 'workspace',
      header: 'Workspace',
      enableSorting: false,
      cell: ({ row: { original: t } }) => <span className="truncate text-compact text-body">{t.workspaceHost ?? '—'}</span>,
      meta: { wide: true },
    },
    {
      id: 'parent',
      header: 'Parent',
      enableSorting: false,
      cell: ({ row: { original: t } }) => (
        <span className="truncate text-compact text-body">{t.parentName ?? '—'}</span>
      ),
      meta: { wide: true },
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: 'Created',
      enableSorting: true,
      cell: ({ row: { original: t } }) => (
        <span className="text-compact text-body tabular-nums">{created.format(new Date(t.createdAt))}</span>
      ),
      meta: { wide: true },
    },
    {
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row: { original: t } }) => (
        <Badge variant={STATUS[t.status].tone} size="sm">
          {/* Lowercase text, the first letter capitalised visually, as the tenants page shows it. */}
          <span className="inline-block first-letter:uppercase">{STATUS[t.status].label.toLowerCase()}</span>
        </Badge>
      ),
      meta: { align: 'right' },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row: { original: t } }) => (
        <div className="flex items-center justify-end gap-1.5">
          {ACTIONS[t.status].map((a) => (
            <Button key={a} variant="outline" size="xs" disabled title={NOT_YET} className={cn(a === 'Archive' && 'text-tone-risk-foreground')}>
              {a}
            </Button>
          ))}
        </div>
      ),
      meta: { className: 'w-8' },
    },
  ]
}
